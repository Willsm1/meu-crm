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
const AUTH_DIR = process.env.WA_AUTH_DIR || './.auth/taurus-test';
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, 'public')));

let sock = null;
let starting = null;
let reconnectTimer = null;
let state = {
  phase: 'idle',
  connected: false,
  qr: null,
  qrDataUrl: null,
  user: null,
  lastError: null,
  updatedAt: new Date().toISOString()
};

function patch(next) {
  state = { ...state, ...next, updatedAt: new Date().toISOString() };
}

function statusPayload() {
  return {
    phase: state.phase,
    connected: state.connected,
    qr: state.qr,
    qrDataUrl: state.qrDataUrl,
    user: state.user,
    lastError: state.lastError,
    updatedAt: state.updatedAt
  };
}

async function connect() {
  if (starting) return starting;
  if (sock && state.connected) return statusPayload();

  starting = (async () => {
    patch({ phase: 'starting', connected: false, lastError: null });

    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const nextSock = makeWASocket({
      auth,
      browser: Browsers.windows('Desktop'),
      syncFullHistory: true,
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      logger
    });

    sock = nextSock;
    nextSock.ev.on('creds.update', saveCreds);

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
          logger.warn({ err }, 'failed to render qr');
        }
        patch({
          phase: 'qr',
          connected: false,
          qr,
          qrDataUrl,
          lastError: null
        });
      }

      if (connection === 'open') {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        patch({
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
        patch({
          phase: loggedOut ? 'logged_out' : 'disconnected',
          connected: false,
          qr: null,
          qrDataUrl: null,
          lastError: lastDisconnect?.error?.message || String(lastDisconnect?.error || 'connection closed')
        });
        sock = null;

        if (!loggedOut && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect().catch(err => {
              patch({ phase: 'error', lastError: err.message || String(err) });
            });
          }, 1500);
        }
      }
    });

    // Gate 1 only: prove QR -> pairing -> persistent session.
    // Message ingestion is intentionally NOT implemented in this experiment.
    return statusPayload();
  })();

  try {
    return await starting;
  } catch (err) {
    patch({ phase: 'error', connected: false, lastError: err.message || String(err) });
    throw err;
  } finally {
    starting = null;
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'taurus-whatsapp-qr-poc', ...statusPayload() });
});

app.get('/session/status', (_req, res) => {
  res.json(statusPayload());
});

app.post('/session/start', async (_req, res) => {
  try {
    await connect();
    res.json({ ok: true, ...statusPayload() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err), ...statusPayload() });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Taurus WhatsApp QR POC] http://127.0.0.1:${PORT}`);
  console.log('[Gate 1] nenhum lead/mensagem sera gravado; apenas autenticacao e persistencia de sessao.');
});
