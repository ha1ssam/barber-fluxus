// Agendador embutido: em hospedagens sem worker separado (ex.: plano grátis do Render),
// INTERNAL_CRON=1 faz o próprio servidor chamar /api/cron/tick a cada minuto.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.INTERNAL_CRON !== '1') return;
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/tick`;
  const run = () =>
    fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }).catch(() => undefined);
  setTimeout(run, 15_000);
  setInterval(run, 60_000);
}
