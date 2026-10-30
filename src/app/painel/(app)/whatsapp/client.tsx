'use client';
import { useEffect, useState } from 'react';
import { connectQrAction, disconnectAction, qrStatusAction, saveCloudAction, saveReminderConfigAction, saveTemplateAction, type ConnectionView } from './actions';
import { enablePush } from '@/components/pwa';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Input, Textarea, Toggle } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { CopyButton, PillTabs } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';

export function ConnectionCard({
  initial,
  cloudAllowed,
  gatewayConfigured,
  webhookUrl,
}: {
  initial: { mode: string; status: string; phone: string | null; phoneNumberId: string };
  cloudAllowed: boolean;
  gatewayConfigured: boolean;
  webhookUrl: string;
}) {
  const [mode, setMode] = useState(initial.mode);
  const [view, setView] = useState<ConnectionView>({ status: initial.status, phone: initial.phone, qrDataUrl: null });
  const [polling, setPolling] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState(initial.phoneNumberId);
  const [token, setToken] = useState('');
  const { run, pending, error } = useAction();

  useEffect(() => {
    if (!polling) return;
    const t = setInterval(async () => {
      const r = await qrStatusAction();
      if (r.ok && r.data) {
        setView(r.data);
        if (r.data.status === 'CONNECTED' || r.data.status === 'DISCONNECTED') setPolling(false);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [polling]);

  const connected = view.status === 'CONNECTED' && mode === initial.mode;
  return (
    <Card title="Conexão">
      <div className="stack">
        <PillTabs
          items={[
            { id: 'QR', label: 'QR Code' },
            { id: 'CLOUD_API', label: cloudAllowed ? 'API oficial' : 'API oficial (Equipe)' },
          ]}
          value={mode}
          onChange={(m) => (m === 'CLOUD_API' && !cloudAllowed ? undefined : setMode(m))}
        />
        <div className="row-between">
          <span className={`chip ${connected ? 'success' : view.status === 'QR' || view.status === 'CONNECTING' ? 'warning' : 'danger'}`}>
            <Icon name="whatsapp" size={12} />
            {connected ? `Conectado${view.phone ? ` · ${view.phone}` : ''}` : view.status === 'QR' ? 'Aguardando leitura do QR Code' : view.status === 'CONNECTING' ? 'Conectando...' : 'Desconectado'}
          </span>
          {connected ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disconnectAction(), { onSuccess: () => setView({ status: 'DISCONNECTED', phone: null, qrDataUrl: null }) })}>
              Desconectar
            </Button>
          ) : null}
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        {mode === 'QR' ? (
          <div className="stack-sm">
            <p className="muted sm-text">
              Conexão como no WhatsApp Web: abra o WhatsApp da loja, toque em Aparelhos conectados e leia o código. Não é a API oficial da Meta, então há risco de bloqueio se o número mandar muita mensagem.
            </p>
            {!gatewayConfigured ? <p className="warning-text sm-text">O serviço de WhatsApp (gateway) não está configurado neste servidor.</p> : null}
            {view.qrDataUrl && !connected ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={view.qrDataUrl} alt="QR Code para conectar o WhatsApp" width={240} height={240} style={{ alignSelf: 'center', borderRadius: 8, background: '#fff', padding: 8 }} />
            ) : null}
            {!connected ? (
              <Button
                icon="qr-code"
                disabled={pending || !gatewayConfigured}
                onClick={() =>
                  run(() => connectQrAction(), {
                    refresh: false,
                    onSuccess: (r) => {
                      if (r.data) setView(r.data);
                      setPolling(true);
                    },
                  })
                }
              >
                {pending ? 'Gerando...' : 'Gerar QR Code'}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="stack-sm">
            <p className="muted sm-text">Use um número no WhatsApp Business Platform (Meta). Cada mensagem tem custo pela Meta, sem risco de bloqueio.</p>
            <Field label="ID do número de telefone" id="pnid">
              <Input id="pnid" placeholder="Ex.: 123456789012345" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Token de acesso permanente" id="token" hint="Fica guardado criptografado.">
              <Input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="URL do webhook (cole no painel da Meta)" id="hook">
              <div className="link-box">
                <span>{webhookUrl}</span>
                <CopyButton text={webhookUrl} />
              </div>
            </Field>
            <Button disabled={pending} onClick={() => run(() => saveCloudAction({ phoneNumberId, accessToken: token }), { onSuccess: () => setToken('') })}>
              {pending ? 'Verificando...' : 'Salvar e conectar'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ReminderForm({ initial }: { initial: { reminderHoursBefore: number; reminderEveHour: number; winbackDays: number } }) {
  const [c, setC] = useState(initial);
  const { run, pending } = useAction();
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="Lembrete (horas antes)" id="h" hint="De 1 a 24 horas.">
          <Input id="h" placeholder="3" type="number" min={1} max={24} value={c.reminderHoursBefore} onChange={(e) => setC({ ...c, reminderHoursBefore: Number(e.target.value) })} />
        </Field>
        <Field label="Lembrete da véspera (hora)" id="eve">
          <Input id="eve" placeholder="20" type="number" min={8} max={22} value={c.reminderEveHour} onChange={(e) => setC({ ...c, reminderEveHour: Number(e.target.value) })} />
        </Field>
        <Field label="Cliente sumido após (dias)" id="wb">
          <Input id="wb" placeholder="45" type="number" min={15} max={365} value={c.winbackDays} onChange={(e) => setC({ ...c, winbackDays: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button disabled={pending} onClick={() => run(() => saveReminderConfigAction(c))}>
          Salvar
        </Button>
      </div>
    </div>
  );
}

export function TemplateEditor({ kind, label, description, enabled, body, defaultBody }: { kind: string; label: string; description: string; enabled: boolean; body: string; defaultBody: string }) {
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(body);
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const dirty = on !== enabled || text !== body;
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
      <div className="row-between">
        <div>
          <div className="strong">{label}</div>
          <div className="muted xs">{description}</div>
        </div>
        <div className="row">
          <Toggle checked={on} onChange={(e) => { setOn(e.target.checked); run(() => saveTemplateAction(kind, e.target.checked, text)); }} label={<span className="sr-only">Ligada</span>} />
          <Button size="sm" variant="ghost" icon={open ? 'chevron-up' : 'edit'} onClick={() => setOpen(!open)}>
            {open ? 'Fechar' : 'Editar'}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="stack-sm" style={{ marginTop: 8 }}>
          <Textarea rows={4} placeholder="Escreva a mensagem. Use {nome}, {data}, {hora}..." value={text} onChange={(e) => setText(e.target.value)} aria-label={`Texto: ${label}`} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" onClick={() => setText(defaultBody)}>
              Restaurar padrão
            </Button>
            <Button size="sm" disabled={pending || !dirty} onClick={() => run(() => saveTemplateAction(kind, on, text))}>
              Salvar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PushCard({ vapidKey }: { vapidKey: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Avisos no celular">
      <div className="stack-sm">
        <p className="muted sm-text">Receba uma notificação quando entrar uma reserva nova ou um cliente cancelar. Instale o app pelo navegador (Adicionar à tela inicial) para receber no iPhone.</p>
        <Button
          variant="ghost"
          icon="send"
          disabled={!vapidKey || busy}
          onClick={async () => {
            setBusy(true);
            const err = await enablePush(vapidKey).catch(() => 'Não foi possível ativar as notificações.');
            setBusy(false);
            toast(err ? 'error' : 'success', err ?? 'Notificações ativadas neste aparelho.');
          }}
        >
          {vapidKey ? 'Ativar neste aparelho' : 'Indisponível neste servidor'}
        </Button>
      </div>
    </Card>
  );
}
