import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState
} from 'baileys';

const PORT = Number(process.env.PORT || 8787);
const AUTH_ROOT = process.env.WA_AUTH_ROOT || './.auth';
const DEFAULT_SESSION_ID = process.env.WA_DEFAULT_SESSION_ID || 'taurus-test';
const MAX_EVENTS_PER_SESSION = Number(process.env.WA_EVENT_BUFFER || 500);
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

function normalizeSessionId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) {
    throw new Error('sessionId invalido: use apenas a-z, 0-9, _ ou -, maximo 64 caracteres');
  }
  return id;
}

function createSession(sessionId) {
  return {
    sessionId,
    authDir: path.join(AUTH_ROOT, sessionId),
    sock: null,
    starting: null,
    reconnectTimer: null,
    events: [],
    state: {
      phase: 'idle',
      connected: false,
      qr: null,
      qrDataUrl: null,
      user: null,
      lastError: null,
      updatedAt: new Date().toISOString()
    }
  };
}

function getSession(value = DEFAULT_SESSION_ID) {
  const sessionId = normalizeSessionId(value);
  if (!sessions.has(sessionId)) sessions.set(sessionId, createSession(sessionId));
  return sessions.get(sessionId);
}

function patch(session, next) {
  session.state = { ...session.state, ...next, updatedAt: new Date().toISOString() };
}

function statusPayload(session) {
  return {
    sessionId: session.sessionId,
    phase: session.state.phase,
    connected: session.state.connected,
    qr: session.state.qr,
    qrDataUrl: session.state.qrDataUrl,
    user: session.state.user,
    lastError: session.state.lastError,
    eventCount: session.events.length,
    updatedAt: session.state.updatedAt
  };
}

function asEpochMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
  if (typeof value === 'bigint') return Number(value) * 1000;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? (n > 1e12 ? n : n * 1000) : null;
  }
  if (typeof value?.toNumber === 'function') return value.toNumber() * 1000;
  const n = Number(value);
  return Number.isFinite(n) ? (n > 1e12 ? n : n * 1000) : null;
}

function pushEvent(session, event) {
  session.events.push(event);
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.splice(0, session.events.length - MAX_EVENTS_PER_SESSION);
  }
}

function captureMessageUpsert(session, upsert) {
  const receivedAt = Date.now();
  const type = upsert?.type || 'unknown';
  for (const msg of upsert?.messages || []) {
    const jid = msg?.key?.remoteJid || null;
    if (!jid) continue;
    const event = {
      sessionId: session.sessionId,
      source: 'messages.upsert',
      upsertType: type,
      live: type === 'notify',
      messageId: msg?.key?.id || null,
      chatJid: jid,
      participantJid: msg?.key?.participant || null,
      fromMe: Boolean(msg?.key?.fromMe),
      direction: msg?.key?.fromMe ? 'outbound' : 'inbound',
      messageTimestampMs: asEpochMs(msg?.messageTimestamp),
      receivedAtMs: receivedAt,
      hasMessage: Boolean(msg?.message),
      messageType: msg?.message ? Object.keys(msg.message)[0] || null : null
    };
    pushEvent(session, event);
  }
}

async function connect(sessionId = DEFAULT_SESSION_ID) {
  const session = getSession(sessionId);
  if (session.starting) return session.starting;
  if (session.sock && session.state.connected) return statusPayload(session);

  session.starting = (async () => {
    patch(session, { phase: 'starting', connected: false, lastError: null });

    const { state: auth, saveCreds } = await useMultiFileAuthState(session.authDir);
    const nextSock = makeWASocket({
      auth,
      browser: Browsers.windows('Desktop'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      logger
    });

    session.sock = nextSock;
    nextSock.ev.on('creds.update', saveCreds);
    nextSock.ev.on('messages.upsert', upsert => captureMessageUpsert(session, upsert));

    nextSock.ev.on('connection.update', async update => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        let qrDataUrl = null;
        try {
          qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            errorCorrectionLevel: 'M'
          });
        } catch (err) {
          logger.warn({ err, sessionId: session.sessionId }, 'failed to render qr');
        }
        patch(session, {
          phase: 'qr',
          connected: false,
          qr,
          qrDataUrl,
          lastError: null
        });
      }

      if (connection === 'open') {
        if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
        patch(session, {
          phase: 'connected',
          connected: true,
          qr: null,
          qrDataUrl: null,
          user: nextSock.user ? {
            id: nextSock.user.id || null,
            name: nextSock.user.name || null
          } : null,
          lastError: null
        });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        patch(session, {
          phase: loggedOut ? 'logged_out' : 'disconnected',
          connected: false,
          qr: null,
          qrDataUrl: null,
          lastError: lastDisconnect?.error?.message || String(lastDisconnect?.error || 'connection closed')
        });
        session.sock = null;

        if (!loggedOut && !session.reconnectTimer) {
          session.reconnectTimer = setTimeout(() => {
            session.reconnectTimer = null;
            connect(session.sessionId).catch(err => {
              patch(session, { phase: 'error', lastError: err.message || String(err) });
            });
          }, 1500);
        }
      }
    });

    return statusPayload(session);
  })();

  try {
    return await session.starting;
  } catch (err) {
    patch(session, { phase: 'error', connected: false, lastError: err.message || String(err) });
    throw err;
  } finally {
    session.starting = null;
  }
}

function sessionFromRequest(req) {
  return getSession(req.params.sessionId || req.query.sessionId || DEFAULT_SESSION_ID);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'taurus-whatsapp-qr-poc',
    gate: 2,
    sessions: [...sessions.values()].map(statusPayload)
  });
});

app.get('/sessions', (_req, res) => {
  res.json({ sessions: [...sessions.values()].map(statusPayload) });
});

app.get('/session/status', (req, res) => {
  res.json(statusPayload(sessionFromRequest(req)));
});

app.post('/session/start', async (req, res) => {
  const sessionId = req.body?.sessionId || req.query.sessionId || DEFAULT_SESSION_ID;
  try {
    const payload = await connect(sessionId);
    res.json({ ok: true, ...payload });
  } catch (err) {
    const session = getSession(sessionId);
    res.status(500).json({ ok: false, error: err.message || String(err), ...statusPayload(session) });
  }
});

app.get('/session/:sessionId/status', (req, res) => {
  try {
    res.json(statusPayload(getSession(req.params.sessionId)));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.post('/session/:sessionId/start', async (req, res) => {
  try {
    const payload = await connect(req.params.sessionId);
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.get('/session/:sessionId/events', (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const requested = Number(req.query.limit || 100);
    const limit = Math.max(1, Math.min(500, Number.isFinite(requested) ? requested : 100));
    res.json({
      sessionId: session.sessionId,
      count: session.events.length,
      events: session.events.slice(-limit)
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.delete('/session/:sessionId/events', (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    session.events.length = 0;
    res.json({ ok: true, sessionId: session.sessionId, count: 0 });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Taurus WhatsApp QR POC] http://127.0.0.1:${PORT}`);
  console.log('[Gate 2] multi-sessao + observacao de eventos; nenhuma gravacao em Supabase.');
});
