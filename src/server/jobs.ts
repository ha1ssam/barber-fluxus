import 'server-only';
import { db } from '@/lib/db';
import { processDueMessages, scheduleDailyCampaigns } from './messages';

let lastCampaignRun = 0;

/** Um "tick" do agendador: envia a fila e, a cada 15 minutos, agenda campanhas e vence assinaturas. */
export async function tick(now = new Date()) {
  const messages = await processDueMessages(now);
  let campaigns = { created: 0 };
  if (now.getTime() - lastCampaignRun > 15 * 60_000) {
    lastCampaignRun = now.getTime();
    campaigns = await scheduleDailyCampaigns(now);
    // Teste vencido e assinatura paga sem renovação viram EXPIRED (só para relatório; o acesso já é calculado por data).
    await db.subscription.updateMany({ where: { status: 'TRIALING', trialEndsAt: { lt: now } }, data: { status: 'EXPIRED' } });
    await db.subscription.updateMany({ where: { status: { in: ['ACTIVE', 'CANCELED'] }, currentPeriodEnd: { lt: new Date(now.getTime() - 3 * 86_400_000) } }, data: { status: 'EXPIRED' } });
    await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  }
  return { messages, campaigns };
}
