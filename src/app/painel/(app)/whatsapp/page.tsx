import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { hasFeature } from '@/lib/domain/plans';
import { formatPhone } from '@/lib/domain/phone';
import { CONFIGURABLE_TEMPLATES, DEFAULT_TEMPLATES } from '@/lib/domain/templates';
import { formatDateTimeBR } from '@/lib/domain/time';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { Card, EmptyState, Notice } from '@/components/ui/basic';
import { requireMember } from '@/server/context';
import { isDevSimulation } from '@/server/whatsapp/provider';
import { ConnectionCard, PushCard, ReminderForm, TemplateEditor } from './client';

export const metadata = { title: 'WhatsApp' };

const KIND_LABELS: Record<string, string> = Object.fromEntries(Object.entries(DEFAULT_TEMPLATES).map(([k, v]) => [k, v.label]));
const STATUS_LABEL: Record<string, string> = { PENDING: 'Na fila', SENT: 'Enviada', FAILED: 'Falhou', CANCELLED: 'Cancelada', SKIPPED: 'Não enviada' };

export default async function WhatsAppPage() {
  const ctx = await requireMember('whatsapp');
  if (!hasFeature(ctx.plan, 'whatsapp_qr')) return <Page title="WhatsApp" icon="whatsapp"><FeatureLocked feature="WhatsApp" reason={ctx.plan.reason} /></Page>;
  const [conn, templates, logs, queue] = await Promise.all([
    db.whatsAppConnection.findUnique({ where: { shopId: ctx.shop.id } }),
    db.messageTemplate.findMany({ where: { shopId: ctx.shop.id } }),
    db.messageLog.findMany({ where: { shopId: ctx.shop.id }, orderBy: { createdAt: 'desc' }, take: 40 }),
    db.scheduledMessage.findMany({ where: { shopId: ctx.shop.id, OR: [{ status: 'PENDING' }, { status: { in: ['FAILED', 'SKIPPED'] }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }] }, orderBy: { sendAt: 'asc' }, take: 30 }),
  ]);
  const tz = ctx.shop.timezone;
  return (
    <Page title="WhatsApp" icon="whatsapp">
      {isDevSimulation() ? <Notice type="info">Modo de desenvolvimento: sem gateway configurado, as mensagens são escritas no log do servidor em vez de enviadas.</Notice> : null}
      <div className="grid-2">
        <ConnectionCard
          initial={{ mode: conn?.mode ?? 'QR', status: conn?.status ?? 'DISCONNECTED', phone: conn?.phone ? formatPhone(conn.phone.replace(/\D/g, '')) : null, phoneNumberId: conn?.cloudPhoneNumberId ?? '' }}
          cloudAllowed={hasFeature(ctx.plan, 'whatsapp_cloud')}
          gatewayConfigured={!!env.gatewayUrl()}
          webhookUrl={`${env.appUrl}/api/whatsapp/meta`}
        />
        <div className="stack">
          <Card title="Lembretes e campanhas">
            <ReminderForm initial={{ reminderHoursBefore: ctx.shop.reminderHoursBefore, reminderEveHour: ctx.shop.reminderEveHour, winbackDays: ctx.shop.winbackDays }} />
          </Card>
          <PushCard vapidKey={env.vapidPublic()} />
        </div>
      </div>
      <Card title="Mensagens automáticas">
        <p className="muted sm-text" style={{ marginBottom: 12 }}>
          Variáveis: {'{nome}'} {'{loja}'} {'{data}'} {'{hora}'} {'{servicos}'} {'{profissional}'} {'{valor}'} {'{link}'}. O robô responde sozinho com um menu (agendar, confirmar, cancelar, falar com atendente) e entende SIM e CANCELAR nos lembretes.
        </p>
        <div className="stack">
          {CONFIGURABLE_TEMPLATES.map((kind) => {
            const row = templates.find((t) => t.kind === kind);
            return <TemplateEditor key={kind} kind={kind} label={DEFAULT_TEMPLATES[kind].label} description={DEFAULT_TEMPLATES[kind].description} enabled={row?.enabled ?? true} body={row?.body || DEFAULT_TEMPLATES[kind].body} defaultBody={DEFAULT_TEMPLATES[kind].body} />;
          })}
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Fila de envio">
          {queue.length === 0 ? (
            <p className="muted sm-text">Nada na fila.</p>
          ) : (
            <ul className="list-plain">
              {queue.map((m) => (
                <li key={m.id} className="list-item sm-text">
                  <div className="grow">
                    <div className="strong">{KIND_LABELS[m.kind]} · {formatPhone(m.toPhone)}</div>
                    <div className="muted xs">
                      {formatDateTimeBR(m.sendAt, tz)}
                      {m.lastError ? ` · ${m.lastError}` : ''}
                    </div>
                  </div>
                  <span className={`chip ${m.status === 'FAILED' ? 'danger' : m.status === 'SKIPPED' ? 'warning' : 'brand'}`}>{STATUS_LABEL[m.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Histórico de mensagens">
          {logs.length === 0 ? (
            <EmptyState icon="chat" title="Nenhuma mensagem ainda" />
          ) : (
            <ul className="list-plain">
              {logs.map((l) => (
                <li key={l.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ background: l.direction === 'OUT' ? 'var(--msg-outgoing-bg)' : 'var(--msg-incoming-bg)', padding: '8px 12px', borderRadius: 8 }}>
                    <div className="xs muted">
                      {l.direction === 'OUT' ? 'Enviada para' : 'Recebida de'} {formatPhone(l.phone)} · {formatDateTimeBR(l.createdAt, tz)}
                    </div>
                    <div className="sm-text msg-body">{l.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
