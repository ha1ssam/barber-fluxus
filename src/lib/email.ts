import 'server-only';
import { env } from './env';

/** E-mail transacional pelo Resend. Sem chave configurada, escreve no log (desenvolvimento). */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = env.resendKey();
  if (!key) {
    console.info(`[email:simulado] para ${to} — ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom(), to, subject, html }),
  });
  if (!res.ok) console.error('Falha ao enviar e-mail', res.status, await res.text().catch(() => ''));
}

export function emailLayout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1d1d1f">
<h2 style="margin:0 0 12px">${title}</h2><p style="line-height:1.5;color:#3a3a3c">${body}</p>
${cta ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#6656e2;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p><p style="font-size:12px;color:#6e6e73">Se o botão não funcionar, copie: ${cta.url}</p>` : ''}
</div>`;
}
