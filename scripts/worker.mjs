// Worker do agendador: chama /api/cron/tick a cada minuto (fila de WhatsApp, lembretes e campanhas).
// No Docker roda como serviço próprio; em outra hospedagem, um cron externo pode chamar a mesma URL.
const url = `${(process.env.APP_INTERNAL_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/cron/tick`;
const secret = process.env.CRON_SECRET;
const interval = Number(process.env.WORKER_INTERVAL_MS || 60_000);

if (!secret) {
  console.error('CRON_SECRET não definido. O worker não pode chamar o app.');
  process.exit(1);
}

async function run() {
  try {
    const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) console.error(`[worker] ${res.status}`, body);
    else if (body.messages?.processed || body.campaigns?.created) console.log(`[worker] ${new Date().toISOString()}`, JSON.stringify(body));
  } catch (e) {
    console.error('[worker] app indisponível:', e.message);
  }
}

console.log(`[worker] chamando ${url} a cada ${interval / 1000}s`);
void run();
setInterval(run, interval);
