import 'server-only';
import webpush from 'web-push';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

let configured = false;
function setup() {
  if (configured) return true;
  if (!env.vapidPublic() || !env.vapidPrivate()) return false;
  webpush.setVapidDetails(env.vapidSubject(), env.vapidPublic(), env.vapidPrivate());
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Notificação push (PWA) para o dono, a recepção e o profissional do horário. Sem VAPID, não faz nada. */
export async function notifyShopStaff(shopId: string, professionalId: string | null, payload: PushPayload) {
  if (!setup()) return;
  const members = await db.membership.findMany({
    where: { shopId, active: true, OR: [{ role: { in: ['OWNER', 'RECEPTIONIST'] } }, ...(professionalId ? [{ id: professionalId }] : [])] },
    select: { userId: true },
  });
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: members.map((m) => m.userId) } } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
    }),
  );
}
