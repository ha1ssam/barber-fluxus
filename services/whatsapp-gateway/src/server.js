// Gateway de WhatsApp por QR Code. Uma sessão do Baileys por loja, salva em disco e restaurada ao iniciar.
// O app fala com este serviço por HTTP com o cabeçalho x-gateway-secret; este serviço avisa o app
// em POST {APP_URL}/api/whatsapp/gateway (mensagens recebidas e mudanças de status).
import { createServer } from 'node:http';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import pino from 'pino';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { createLimiter, phoneFromKey, textOf } from './limits.js';

const SECRET = process.env.WHATSAPP_GATEWAY_SECRET;
const APP_URL = (process.env.APP_INTERNAL_URL || process.env.APP_URL || '').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 4010);
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.resolve('sessions');

// Sem segredo o serviço não sobe: ninguém na rede interna pode mandar mensagem em nome das lojas.
if (!SECRET || SECRET.length < 16) {
  console.error('WHATSAPP_GATEWAY_SECRET ausente ou curto (mínimo 16 caracteres). Encerrando.');
  process.exit(1);
}
if (!APP_URL) {
  console.error('APP_URL não definido. Encerrando.');
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });
const sendLimiter = createLimiter(8, 60_000);
/** @type {Map<string, { sock: any, status: string, qr: string|null, phone: string|null, retries: number }>} */
const sessions = new Map();
let waVersion;

const validShopId = (id) => /^[a-z0-9]{10,40}$/i.test(id);

async function notifyApp(payload) {
  try {
    await fetch(`${APP_URL}/api/whatsapp/gateway`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gateway-secret': SECRET },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    logger.error({ err: e.message }, 'falha ao avisar o app');
  }
}

async function connect(shopId) {
  const existing = sessions.get(shopId);
  if (existing && (existing.status === 'CONNECTED' || existing.status === 'CONNECTING' || existing.status === 'QR')) return existing;
  const dir = path.join(SESSIONS_DIR, shopId);
  await mkdir(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  waVersion ??= (await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))).version;
  const sock = makeWASocket({ version: waVersion, auth: state, logger, browser: ['Fluxus', 'Chrome', '1.0'], markOnlineOnConnect: false, syncFullHistory: false });
  const entry = { sock, status: 'CONNECTING', qr: null, phone: null, retries: existing?.retries ?? 0 };
  sessions.set(shopId, entry);

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      entry.status = 'QR';
      entry.qr = qr;
      await notifyApp({ type: 'status', shopId, status: 'QR', qr });
    }
    if (connection === 'open') {
      entry.status = 'CONNECTED';
      entry.qr = null;
      entry.retries = 0;
      entry.phone = (sock.user?.id || '').split(':')[0].split('@')[0] || null;
      await notifyApp({ type: 'status', shopId, status: 'CONNECTED', phone: entry.phone });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      sessions.delete(shopId);
      if (loggedOut) {
        await rm(dir, { recursive: true, force: true });
        await notifyApp({ type: 'status', shopId, status: 'DISCONNECTED' });
        return;
      }
      // Reconexão automática com espera crescente (até ~5 min).
      const retries = entry.retries + 1;
      const wait = Math.min(300_000, 2 ** Math.min(retries, 8) * 1000);
      await notifyApp({ type: 'status', shopId, status: 'CONNECTING' });
      setTimeout(() => {
        sessions.set(shopId, { ...entry, status: 'DISCONNECTED', retries });
        connect(shopId).catch((e) => logger.error({ shopId, err: e.message }, 'falha ao reconectar'));
      }, wait);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      const from = phoneFromKey(m.key);
      const text = textOf(m.message).trim();
      if (!from || !text) continue;
      await notifyApp({ type: 'message', shopId, from, text: text.slice(0, 4000) });
    }
  });
  return entry;
}

async function restoreAll() {
  await mkdir(SESSIONS_DIR, { recursive: true });
  for (const name of await readdir(SESSIONS_DIR)) {
    if (validShopId(name)) await connect(name).catch((e) => logger.error({ shopId: name, err: e.message }, 'falha ao restaurar'));
  }
}

function authorized(req) {
  const got = Buffer.from(String(req.headers['x-gateway-secret'] || ''));
  const want = Buffer.from(SECRET);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) throw new Error('corpo grande demais');
  }
  return body ? JSON.parse(body) : {};
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

const view = (e) => ({ status: e?.status ?? 'DISCONNECTED', qr: e?.qr ?? null, phone: e?.phone ?? null });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/health') return send(res, 200, { ok: true, sessions: sessions.size });
    if (!authorized(req)) return send(res, 401, { error: 'não autorizado' });
    const m = url.pathname.match(/^\/sessions\/([^/]+)(\/connect|\/messages)?$/);
    if (!m || !validShopId(m[1])) return send(res, 404, { error: 'não encontrado' });
    const [, shopId, action] = m;

    if (req.method === 'POST' && action === '/connect') {
      const entry = await connect(shopId);
      // Espera um pouco o primeiro QR para devolver já na resposta.
      for (let i = 0; i < 20 && entry.status === 'CONNECTING'; i++) await new Promise((r) => setTimeout(r, 250));
      return send(res, 200, view(entry));
    }
    if (req.method === 'GET' && !action) return send(res, 200, view(sessions.get(shopId)));
    if (req.method === 'DELETE' && !action) {
      const entry = sessions.get(shopId);
      if (entry) await entry.sock.logout().catch(() => entry.sock.end(undefined));
      sessions.delete(shopId);
      await rm(path.join(SESSIONS_DIR, shopId), { recursive: true, force: true });
      return send(res, 200, view(null));
    }
    if (req.method === 'POST' && action === '/messages') {
      const entry = sessions.get(shopId);
      if (!entry || entry.status !== 'CONNECTED') return send(res, 409, { error: 'sessão não conectada' });
      const { to, text } = await readJson(req);
      const digits = String(to || '').replace(/\D/g, '');
      if (digits.length < 8 || !text) return send(res, 400, { error: 'destino ou texto inválido' });
      if (!sendLimiter.allow(`${shopId}:${digits}`)) return send(res, 429, { error: 'limite de envio por conversa atingido' });
      await entry.sock.sendMessage(`${digits}@s.whatsapp.net`, { text: String(text).slice(0, 4096) });
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'método não permitido' });
  } catch (e) {
    logger.error({ err: e.message }, 'erro na requisição');
    return send(res, 500, { error: 'erro interno' });
  }
});

server.listen(PORT, () => {
  console.log(`[gateway] ouvindo na porta ${PORT}; sessões em ${SESSIONS_DIR}`);
  restoreAll().catch((e) => logger.error({ err: e.message }, 'falha ao restaurar sessões'));
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const { sock } of sessions.values()) sock.end(undefined);
    server.close(() => process.exit(0));
  });
}
