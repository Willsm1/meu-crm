import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  jidNormalizedUser,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const SESSION_KEY = String(process.env.SESSION_KEY || 'local-test').replace(/[^a-zA-Z0-9._-]/g, '_');
const SESSIONS_DIR = path.resolve(__dirname, '..', '.sessions');
const AUTH_DIR = path.join(SESSIONS_DIR, SESSION_KEY);
fs.mkdirSync(AUTH_DIR, { recursive: true });

let sock = null;
let connectPromise = null;
let state = {
  status: 'idle',
  qrDataUrl: null,
  connectedJid: null,
  lastError: null,
  lastEventAt: null
};
const clients = new Set();

function setState(patch) {
  state = { ...state, ...patch, lastEventAt: new Date().toISOString() };
  broadcast({ type: 'state', state });
}

function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of [...clients]) {
    try { res.write(data); } catch { clients.delete(res); }
  }
}

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGIN === '*' ? '*' : (origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'content-type,authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Vary': 'Origin'
  };
}

function json(res, req, code, body) {
  res.writeHead(code, { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function normalizedPhoneFromKey(key = {}) {
  const candidates = [key.remoteJidAlt, key.remoteJid]
    .map(v => String(v || ''))
    .filter(Boolean);
  for (const jid of candidates) {
    const norm = jidNormalizedUser(jid);
    const m = norm.match(/^(\d{8,15})@(?:s\.whatsapp\.net|c\.us)$/i);
    if (m) return m[1];
  }
  return null;
}

function extractText(message) {
  if (!message || typeof message !== 'object') return '';
  const direct = message.conversation || message.extendedTextMessage?.text || '';
  if (direct) return String(direct).slice(0, 500);
  const caption = message.imageMessage?.caption || message.videoMessage?.caption || message.documentMessage?.caption || '';
  return String(caption || '').slice(0, 500);
}

function normalizeMessageEvent(msg) {
  const key = msg?.key || {};
  const remoteJid = String(key.remoteJid || '');
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return null;
  const tsRaw = msg?.messageTimestamp;
  const tsSec = typeof tsRaw === 'object' && tsRaw?.toNumber ? tsRaw.toNumber() : Number(tsRaw || Math.floor(Date.now() / 1000));
  return {
    id: String(key.id || ''),
    remoteJid,
    phone: normalizedPhoneFromKey(key),
    direction: key.fromMe ? 'outbound' : 'inbound',
    occurredAt: new Date(tsSec * 1000).toISOString(),
    textPreview: extractText(msg?.message),
    source: 'whatsapp_qr_experiment'
  };
}

async function connectWhatsApp() {
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    setState({ status: 'connecting', lastError: null });
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const ws = makeWASocket({
      auth: authState,
      browser: Browsers.macOS('Taurus Magnum CRM'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    });
    sock = ws;

    ws.ev.on('creds.update', saveCreds);

    ws.ev.on('connection.update', async update => {
      const { connection, qr, lastDisconnect } = update;
      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        setState({ status: 'qr', qrDataUrl, lastError: null });
      }
      if (connection === 'open') {
        setState({
          status: 'connected',
          qrDataUrl: null,
          connectedJid: ws.user?.id || null,
          lastError: null
        });
      }
      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error).output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        setState({
          status: loggedOut ? 'logged_out' : 'disconnected',
          qrDataUrl: null,
          connectedJid: null,
          lastError: lastDisconnect?.error ? String(lastDisconnect.error) : null
        });
        sock = null;
        connectPromise = null;
        if (!loggedOut) setTimeout(() => connectWhatsApp().catch(() => {}), 1500);
      }
    });

    ws.ev.on('messages.upsert', ({ messages, type }) => {
      for (const msg of messages || []) {
        const event = normalizeMessageEvent(msg);
        if (!event) continue;
        broadcast({ type: 'message', upsertType: type, event });
      }
    });

    return { ok: true };
  })().catch(err => {
    connectPromise = null;
    sock = null;
    setState({ status: 'error', lastError: String(err?.stack || err) });
    throw err;
  });
  return connectPromise;
}

async function disconnectWhatsApp() {
  const current = sock;
  sock = null;
  connectPromise = null;
  if (current) {
    try { current.end(new Error('manual disconnect')); } catch {}
  }
  setState({ status: 'idle', qrDataUrl: null, connectedJid: null, lastError: null });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, req, 200, { ok: true, status: state.status });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return json(res, req, 200, state);
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      ...corsHeaders(req),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'state', state })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/session/start') {
    connectWhatsApp().catch(() => {});
    return json(res, req, 202, { ok: true, status: state.status });
  }

  if (req.method === 'POST' && url.pathname === '/api/session/disconnect') {
    await disconnectWhatsApp();
    return json(res, req, 200, { ok: true, status: state.status });
  }

  return json(res, req, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Taurus QR experiment] listening on :${PORT}`);
  console.log(`[Taurus QR experiment] auth dir: ${AUTH_DIR}`);
});
