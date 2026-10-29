'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { changePasswordAction, deleteAccountAction, saveAgendaAction, saveHoursAction, saveProfileAction, saveShopAction } from './actions';
import { Button, Card, Checkbox, Field, IconButton, Input, Select, Textarea, Toggle } from '@/components/ui/basic';
import { Modal, PillTabs, type TabItem } from '@/components/ui/interactive';
import { useToast } from '@/components/toast';
import { useAction } from '@/components/use-action';
import { AMENITY_OPTIONS, BUSINESS_LABELS, PAYMENT_OPTIONS, UFS } from '@/lib/domain/labels';
import { slugify } from '@/lib/domain/slug';
import { hhmmToMinute, minuteToHHMM, WEEKDAY_NAMES } from '@/lib/domain/time';

export function SettingsTabs({ tabs, value }: { tabs: TabItem[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return <PillTabs items={tabs} value={value} onChange={(v) => router.push(`${pathname}?aba=${v}`)} />;
}

type ShopData = {
  name: string;
  slug: string;
  businessType: string;
  description: string;
  phone: string;
  email: string;
  addressLine: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  logoUrl: string;
  coverUrl: string;
  paymentMethods: string[];
  amenities: string[];
};

function ImageUpload({ label, value, onChange, wide }: { label: string; value: string; onChange: (url: string) => void; wide?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="row">
        <div
          style={{
            width: wide ? 160 : 64,
            height: 64,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: value ? `center/cover no-repeat url(${value})` : 'var(--surface-muted)',
          }}
          aria-hidden
        />
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
          {busy ? 'Enviando...' : value ? 'Trocar' : 'Enviar foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) return toast('error', 'A imagem pode ter no máximo 5 MB.');
              setBusy(true);
              const body = new FormData();
              body.append('file', file);
              const res = await fetch('/api/upload', { method: 'POST', body }).catch(() => null);
              const json = res ? await res.json().catch(() => ({})) : {};
              setBusy(false);
              if (!res?.ok) return toast('error', json.error ?? 'Não foi possível enviar a imagem.');
              onChange(json.url);
            }}
          />
        </label>
        {value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange('')}>
            Remover
          </Button>
        ) : null}
      </div>
      <span className="field-hint">JPG, PNG ou WebP, até 5 MB.</span>
    </div>
  );
}

export function ShopForm({ initial, appUrl }: { initial: ShopData; appUrl: string }) {
  const [d, setD] = useState(initial);
  const [cities, setCities] = useState<string[]>([]);
  const { run, pending } = useAction();
  const set = (k: keyof ShopData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  const toggle = (k: 'paymentMethods' | 'amenities', v: string, on: boolean) => setD({ ...d, [k]: on ? [...d[k], v] : d[k].filter((x) => x !== v) });

  // Lista de cidades do IBGE para o estado escolhido.
  useEffect(() => {
    if (!d.state) return setCities([]);
    let alive = true;
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${d.state}/municipios`)
      .then((r) => r.json())
      .then((xs: { nome: string }[]) => alive && setCities(xs.map((x) => x.nome)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [d.state]);

  return (
    <div className="stack">
      <Card title="Vitrine">
        <div className="stack">
          <div className="form-grid">
            <Field label="Nome do negócio *" id="name">
              <Input id="name" value={d.name} onChange={set('name')} />
            </Field>
            <Field label="Tipo" id="bt">
              <Select id="bt" value={d.businessType} onChange={set('businessType')} options={Object.entries(BUSINESS_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
          </div>
          <Field label="Endereço da sua página" id="slug" hint={`${appUrl.replace(/^https?:\/\//, '')}/${d.slug}`}>
            <Input id="slug" value={d.slug} onChange={(e) => setD({ ...d, slug: slugify(e.target.value) })} />
          </Field>
          <Field label="Descrição" id="desc">
            <Textarea id="desc" rows={3} value={d.description} onChange={set('description')} placeholder="Conte o que faz sua loja especial" />
          </Field>
          <div className="form-grid">
            <ImageUpload label="Foto de perfil (logo)" value={d.logoUrl} onChange={(v) => setD({ ...d, logoUrl: v })} />
            <ImageUpload label="Banner de capa" value={d.coverUrl} onChange={(v) => setD({ ...d, coverUrl: v })} wide />
          </div>
        </div>
      </Card>
      <Card title="Contato e endereço">
        <div className="stack">
          <div className="form-grid">
            <Field label="WhatsApp da loja" id="phone">
              <Input id="phone" type="tel" value={d.phone} onChange={set('phone')} />
            </Field>
            <Field label="E-mail" id="email">
              <Input id="email" type="email" value={d.email} onChange={set('email')} />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Endereço" id="addr">
              <Input id="addr" value={d.addressLine} onChange={set('addressLine')} placeholder="Rua, número" />
            </Field>
            <Field label="Bairro" id="nb">
              <Input id="nb" value={d.neighborhood} onChange={set('neighborhood')} />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Estado" id="uf">
              <Select id="uf" value={d.state} onChange={(e) => setD({ ...d, state: e.target.value, city: '' })} options={[{ value: '', label: 'Escolha' }, ...UFS]} />
            </Field>
            <Field label="Cidade" id="city">
              <Input id="city" value={d.city} onChange={set('city')} list="ibge-cities" autoComplete="off" />
              <datalist id="ibge-cities">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="CEP" id="cep">
              <Input id="cep" value={d.zipCode} onChange={set('zipCode')} inputMode="numeric" />
            </Field>
          </div>
          <p className="field-hint">Sua loja aparece em Explorar quando tem endereço e serviços cadastrados.</p>
        </div>
      </Card>
      <Card title="Pagamento, comodidades e redes">
        <div className="stack">
          <span className="field-label">Formas de pagamento aceitas</span>
          <div className="check-grid">
            {Object.entries(PAYMENT_OPTIONS).map(([k, label]) => (
              <Checkbox key={k} label={label} checked={d.paymentMethods.includes(k)} onChange={(e) => toggle('paymentMethods', k, e.target.checked)} />
            ))}
          </div>
          <span className="field-label">Comodidades</span>
          <div className="check-grid">
            {Object.entries(AMENITY_OPTIONS).map(([k, label]) => (
              <Checkbox key={k} label={label} checked={d.amenities.includes(k)} onChange={(e) => toggle('amenities', k, e.target.checked)} />
            ))}
          </div>
          <div className="form-grid">
            <Field label="Instagram" id="ig">
              <Input id="ig" value={d.instagram} onChange={set('instagram')} placeholder="@sualoja" />
            </Field>
            <Field label="Facebook (link)" id="fb">
              <Input id="fb" value={d.facebook} onChange={set('facebook')} />
            </Field>
            <Field label="TikTok" id="tt">
              <Input id="tt" value={d.tiktok} onChange={set('tiktok')} placeholder="@sualoja" />
            </Field>
          </div>
        </div>
      </Card>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button disabled={pending} onClick={() => run(() => saveShopAction({ ...d, businessType: d.businessType as 'BARBERSHOP' }))}>
          {pending ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}

type Day = { weekday: number; shifts: { start: number; end: number }[] };

export function HoursForm({ membershipId, professionals, initial, canEdit }: { membershipId: string; professionals: { id: string; name: string }[]; initial: Day[]; canEdit: boolean }) {
  const [days, setDays] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  const { run, pending } = useAction();
  const update = (wd: number, fn: (shifts: Day['shifts']) => Day['shifts']) => setDays(days.map((d) => (d.weekday === wd ? { ...d, shifts: fn(d.shifts) } : d)));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Card title="Horário de atendimento">
      <div className="stack">
        {professionals.length > 1 ? (
          <Field label="Profissional:" id="pro">
            <Select id="pro" value={membershipId} onChange={(e) => router.push(`${pathname}?aba=horarios&profissional=${e.target.value}`)} options={professionals.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
        ) : null}
        <p className="muted sm-text">Use dois turnos para marcar o almoço (ex.: 09:00–12:00 e 13:00–19:00). O intervalo entre eles some da agenda online.</p>
        {order.map((wd) => {
          const day = days.find((d) => d.weekday === wd)!;
          const open = day.shifts.length > 0;
          return (
            <div key={wd} className="hours-day">
              <div style={{ paddingTop: 4 }}>
                <Toggle label={WEEKDAY_NAMES[wd]} checked={open} onChange={(e) => update(wd, () => (e.target.checked ? [{ start: 9 * 60, end: 18 * 60 }] : []))} />
              </div>
              <div className="stack-sm">
                {open ? (
                  day.shifts.map((s, i) => (
                    <div key={i} className="hours-shift">
                      <Input
                        type="time"
                        aria-label="Início"
                        value={minuteToHHMM(s.start)}
                        onChange={(e) => update(wd, (xs) => xs.map((x, j) => (j === i ? { ...x, start: hhmmToMinute(e.target.value) ?? x.start } : x)))}
                      />
                      <span className="muted">até</span>
                      <Input
                        type="time"
                        aria-label="Fim"
                        value={minuteToHHMM(s.end)}
                        onChange={(e) => update(wd, (xs) => xs.map((x, j) => (j === i ? { ...x, end: hhmmToMinute(e.target.value) ?? x.end } : x)))}
                      />
                      {day.shifts.length > 1 ? <IconButton icon="trash" label="Remover turno" onClick={() => update(wd, (xs) => xs.filter((_, j) => j !== i))} /> : null}
                      {i === day.shifts.length - 1 && day.shifts.length < 3 ? (
                        <Button size="sm" variant="ghost" icon="plus" onClick={() => update(wd, (xs) => [...xs, { start: Math.min(xs[xs.length - 1].end + 60, 22 * 60), end: Math.min(xs[xs.length - 1].end + 240, 23 * 60 + 30) }])}>
                          Turno
                        </Button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="muted sm-text" style={{ paddingTop: 10 }}>
                    Fechado
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {canEdit ? (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button disabled={pending} onClick={() => run(() => saveHoursAction({ membershipId, days }))}>
              {pending ? 'Salvando...' : 'Salvar horários'}
            </Button>
          </div>
        ) : (
          <p className="muted sm-text">Peça ao dono da loja para alterar seus horários.</p>
        )}
      </div>
    </Card>
  );
}

const TIMEZONES = ['America/Sao_Paulo', 'America/Bahia', 'America/Fortaleza', 'America/Recife', 'America/Belem', 'America/Manaus', 'America/Cuiaba', 'America/Campo_Grande', 'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Noronha'];

export function AgendaForm({ initial }: { initial: { slotInterval: number; bufferMinutes: number; minAdvanceMinutes: number; maxAdvanceDays: number; autoConfirm: boolean; listedInExplore: boolean; timezone: string } }) {
  const [c, setC] = useState(initial);
  const { run, pending } = useAction();
  return (
    <Card title="Regras da agenda">
      <div className="stack">
        <div className="form-grid">
          <Field label="Grade de horários" id="grid" hint="De quanto em quanto tempo os horários aparecem para o cliente.">
            <Select id="grid" value={String(c.slotInterval)} onChange={(e) => setC({ ...c, slotInterval: Number(e.target.value) })} options={['10', '15', '20', '30'].map((v) => ({ value: v, label: `A cada ${v} minutos` }))} />
          </Field>
          <Field label="Intervalo entre clientes (min)" id="buf" hint="Tempo livre depois de cada atendimento.">
            <Input id="buf" type="number" min={0} max={60} step={5} value={c.bufferMinutes} onChange={(e) => setC({ ...c, bufferMinutes: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Antecedência mínima (min)" id="adv" hint="Ex.: 30 = ninguém reserva para daqui a 10 minutos.">
            <Input id="adv" type="number" min={0} step={15} value={c.minAdvanceMinutes} onChange={(e) => setC({ ...c, minAdvanceMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Reservas até quantos dias à frente" id="max">
            <Input id="max" type="number" min={1} max={365} value={c.maxAdvanceDays} onChange={(e) => setC({ ...c, maxAdvanceDays: Number(e.target.value) })} />
          </Field>
          <Field label="Fuso horário" id="tz">
            <Select id="tz" value={c.timezone} onChange={(e) => setC({ ...c, timezone: e.target.value })} options={TIMEZONES.map((t) => ({ value: t, label: t.replace('America/', '').replace('_', ' ') }))} />
          </Field>
        </div>
        <Toggle label="Confirmar agendamentos automaticamente" checked={c.autoConfirm} onChange={(e) => setC({ ...c, autoConfirm: e.target.checked })} />
        <Toggle label="Aparecer em Explorar (catálogo de lojas)" checked={c.listedInExplore} onChange={(e) => setC({ ...c, listedInExplore: e.target.checked })} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button disabled={pending} onClick={() => run(() => saveAgendaAction(c))}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AccountForm({ initial, hasPassword, isOwner }: { initial: { name: string; phone: string; email: string }; hasPassword: boolean; isOwner: boolean }) {
  const [p, setP] = useState(initial);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [del, setDel] = useState(false);
  const [delPass, setDelPass] = useState('');
  const { run, pending, error } = useAction();
  return (
    <div className="grid-2">
      <Card title="Perfil">
        <div className="stack">
          <Field label="Nome" id="n">
            <Input id="n" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </Field>
          <Field label="WhatsApp" id="ph">
            <Input id="ph" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
          </Field>
          <Field label="E-mail" id="em" hint="Para trocar o e-mail, fale com o suporte.">
            <Input id="em" value={p.email} disabled />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button disabled={pending} onClick={() => run(() => saveProfileAction(p))}>
              Salvar
            </Button>
          </div>
        </div>
      </Card>
      <div className="stack">
        <Card title={hasPassword ? 'Trocar senha' : 'Criar senha'}>
          <div className="stack">
            {hasPassword ? (
              <Field label="Senha atual" id="cur">
                <Input id="cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
              </Field>
            ) : null}
            <Field label="Nova senha" id="new" hint="Pelo menos 8 caracteres.">
              <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button disabled={pending} onClick={() => run(() => changePasswordAction(cur, next), { onSuccess: () => { setCur(''); setNext(''); } })}>
                Salvar senha
              </Button>
            </div>
          </div>
        </Card>
        <Card title="Excluir conta">
          <div className="stack-sm">
            <p className="muted sm-text">{isOwner ? 'Exclui sua conta e a sua loja, com agenda, clientes e histórico. Não dá para desfazer.' : 'Exclui sua conta. Você sai da equipe.'}</p>
            <Button variant="danger" icon="trash" onClick={() => setDel(true)} disabled={!hasPassword}>
              Excluir minha conta
            </Button>
            {!hasPassword ? <span className="field-hint">Crie uma senha antes de excluir a conta.</span> : null}
          </div>
        </Card>
      </div>
      {del ? (
        <Modal
          title="Excluir conta?"
          eyebrow="Atenção"
          danger
          onClose={() => setDel(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDel(false)}>
                Voltar
              </Button>
              <Button variant="danger" disabled={pending || !delPass} onClick={() => run(() => deleteAccountAction(delPass))}>
                Excluir definitivamente
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>Digite sua senha para confirmar.</p>
            {error ? <p className="field-error">{error}</p> : null}
            <Input type="password" value={delPass} onChange={(e) => setDelPass(e.target.value)} aria-label="Senha" autoComplete="current-password" />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
