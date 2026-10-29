import 'server-only';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { env } from '@/lib/env';

export interface Sender {
  send(to: string, text: string): Promise<void>;
}

export class SendError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

/** Em desenvolvimento, sem gateway configurado, as mensagens vão para o log do servidor. */
export function isDevSimulation() {
  return process.env.NODE_ENV !== 'production' && !env.gatewayUrl();
}

const logSender: Sender = {
  async send(to, text) {
    console.info(`[whatsapp:simulado] para ${to}:\n${text}\n`);
  },
};

function gatewaySender(shopId: string): Sender {
  return {
    async send(to, text) {
      const res = await fetch(`${env.gatewayUrl()}/sessions/${encodeURIComponent(shopId)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gateway-secret': env.gatewaySecret() },
        body: JSON.stringify({ to, text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new SendError(`Gateway respondeu ${res.status}: ${await res.text().catch(() => '')}`, res.status >= 500);
    },
  };
}

function cloudSender(phoneNumberId: string, token: string): Sender {
  return {
    async send(to, text) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: true } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new SendError(`API da Meta respondeu ${res.status}: ${await res.text().catch(() => '')}`, res.status >= 500 || res.status === 429);
    },
  };
}

/** Escolhe como enviar pela loja. Retorna null se a loja não tem WhatsApp conectado. */
export async function senderFor(shopId: string): Promise<Sender | null> {
  if (isDevSimulation()) return logSender;
  const conn = await db.whatsAppConnection.findUnique({ where: { shopId } });
  if (!conn) return null;
  if (conn.mode === 'CLOUD_API') {
    if (!conn.cloudPhoneNumberId || !conn.cloudAccessTokenEnc) return null;
    return cloudSender(conn.cloudPhoneNumberId, decrypt(conn.cloudAccessTokenEnc));
  }
  if (conn.status !== 'CONNECTED' || !env.gatewayUrl()) return null;
  return gatewaySender(shopId);
}

/** Chamadas ao gateway de QR Code (serviço services/whatsapp-gateway). */
export async function gatewayRequest(path: string, init: RequestInit = {}) {
  if (!env.gatewayUrl()) throw new SendError('Gateway do WhatsApp não configurado.', false);
  const res = await fetch(`${env.gatewayUrl()}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-gateway-secret': env.gatewaySecret(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new SendError(body.error ?? `Gateway respondeu ${res.status}`);
  return body as { status?: string; qr?: string | null; phone?: string | null };
}
