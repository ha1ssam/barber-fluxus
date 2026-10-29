// Variáveis de ambiente lidas num lugar só. Segredos obrigatórios falham cedo em produção.

function required(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error(`Variável de ambiente ${name} não definida.`);
  }
  return devFallback;
}

export const env = {
  get appUrl() {
    // No Render, RENDER_EXTERNAL_URL já vem com o endereço público do app.
    return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '');
  },
  get appSecret() {
    return required('APP_SECRET', 'dev-secret-change-me-dev-secret-change-me');
  },
  get cronSecret() {
    return required('CRON_SECRET', 'dev-cron-secret');
  },
  resendKey: () => process.env.RESEND_API_KEY || '',
  emailFrom: () => process.env.EMAIL_FROM || 'Fluxus <noreply@fluxus.local>',
  googleClientId: () => process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: () => process.env.GOOGLE_CLIENT_SECRET || '',
  stripeKey: () => process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePrice: (plan: string) => process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] || '',
  gatewayUrl: () => (process.env.WHATSAPP_GATEWAY_URL || '').replace(/\/$/, ''),
  gatewaySecret: () => process.env.WHATSAPP_GATEWAY_SECRET || '',
  metaVerifyToken: () => process.env.META_WEBHOOK_VERIFY_TOKEN || '',
  metaAppSecret: () => process.env.META_APP_SECRET || '',
  vapidPublic: () => process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivate: () => process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: () => process.env.VAPID_SUBJECT || 'mailto:contato@fluxus.local',
};
