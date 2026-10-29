'use client';
import { useEffect, useMemo, useState } from 'react';
import { bookAction, joinWaitlistAction } from '@/app/[slug]/actions';
import { BarberCard, Button, Field, Input, ServiceCard, Textarea } from '@/components/ui/basic';
import { Icon, type IconName } from '@/components/ui/Icon';
import { MiniCalendar, Modal, StepPills, TimeSlots } from '@/components/ui/interactive';
import { formatDuration } from '@/lib/domain/labels';
import { formatBRL } from '@/lib/domain/money';
import { formatDateBR, hhmmToMinute, weekdayLong, weekdayOf } from '@/lib/domain/time';
import { groupByPeriod, PERIOD_LABELS } from '@/lib/domain/availability';

interface Service {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  icon: IconName;
}
interface Pro {
  id: string;
  name: string;
  picture: string | null;
  badge: string;
  serviceIds: string[];
  weekdays: number[];
}

const PERIOD_ICONS: Record<string, IconName> = { morning: 'sun', afternoon: 'sun', evening: 'moon' };

export function BookingFlow(props: {
  slug: string;
  shopName: string;
  today: string;
  maxDate: string;
  initialDate?: string;
  referralCode: string;
  prefill: { name: string; phone: string };
  loggedIn: boolean;
  services: Service[];
  professionals: Pro[];
}) {
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [pro, setPro] = useState<string>('any');
  const [date, setDate] = useState<string | null>(props.initialDate ?? null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [name, setName] = useState(props.prefill.name);
  const [phone, setPhone] = useState(props.prefill.phone);
  const [notes, setNotes] = useState('');
  const [ref, setRef] = useState(props.referralCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string; status: string } | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);
  const [waitDone, setWaitDone] = useState<number | null>(null);

  const chosen = props.services.filter((s) => serviceIds.includes(s.id));
  const total = chosen.reduce((s, x) => s + x.priceCents, 0);
  const duration = chosen.reduce((s, x) => s + x.durationMinutes, 0);
  const able = useMemo(() => props.professionals.filter((p) => serviceIds.every((id) => p.serviceIds.includes(id))), [props.professionals, serviceIds]);
  const showProStep = props.professionals.length > 1;
  const steps = [
    { key: 'services', label: 'Serviços', icon: 'cut' as IconName },
    ...(showProStep ? [{ key: 'pro', label: 'Profissional', icon: 'user' as IconName }] : []),
    { key: 'date', label: 'Data', icon: 'calendar' as IconName },
    { key: 'time', label: 'Horário', icon: 'time-five' as IconName },
    { key: 'confirm', label: 'Confirmar', icon: 'check-circle' as IconName },
  ];
  const current = steps[step].key;
  const workingDays = useMemo(() => new Set((pro === 'any' ? able : able.filter((p) => p.id === pro)).flatMap((p) => p.weekdays)), [able, pro]);

  useEffect(() => {
    if (current !== 'time' || !date) return;
    let alive = true;
    setSlots(null);
    const q = new URLSearchParams({ date, services: serviceIds.join(','), pro });
    fetch(`/api/public/${props.slug}/slots?${q}`)
      .then((r) => r.json())
      .then((j) => alive && setSlots(j.slots ?? []))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [current, date, pro, serviceIds, props.slug]);

  const go = (key: string) => setStep(steps.findIndex((s) => s.key === key));
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const canNext =
    (current === 'services' && serviceIds.length > 0 && able.length > 0) || (current === 'pro' && !!pro) || (current === 'date' && !!date) || (current === 'time' && !!time);

  async function confirm() {
    setError(null);
    setBusy(true);
    const r = await bookAction({ slug: props.slug, serviceIds, professionalId: pro, date: date!, time: time!, name, phone, notes, referralCode: ref });
    setBusy(false);
    if (r.ok) setDone({ token: r.token, status: r.status });
    else {
      setError(r.error);
      if (r.error.includes('ocupado') || r.error.includes('disponível')) {
        setTime(null);
        go('time');
      }
    }
  }

  if (done) {
    const start = hhmmToMinute(time!)!;
    const pad = (n: number) => String(n).padStart(2, '0');
    const gcalStart = `${date!.replace(/-/g, '')}T${pad(Math.floor(start / 60))}${pad(start % 60)}00`;
    const endMin = start + duration;
    const gcalEnd = `${date!.replace(/-/g, '')}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${chosen.map((s) => s.name).join(' + ')} · ${props.shopName}`)}&dates=${gcalStart}/${gcalEnd}`;
    return (
      <div className="stack" style={{ textAlign: 'center', alignItems: 'center', padding: '24px 0' }}>
        <div className="kpi-icon" style={{ background: 'var(--success-tint)' }}>
          <Icon name="check-circle" size={28} style={{ color: 'var(--success-text)' }} />
        </div>
        <h2 className="section-title">{done.status === 'CONFIRMED' ? 'Horário confirmado!' : 'Reserva enviada!'}</h2>
        <p className="muted">
          {weekdayLong(date!)}, {formatDateBR(date!)} às {time} · {chosen.map((s) => s.name).join(' + ')}
        </p>
        <p className="sm-text" style={{ maxWidth: 420 }}>
          {done.status === 'CONFIRMED' ? 'Você vai receber a confirmação e um lembrete no WhatsApp.' : 'A loja vai confirmar seu horário. Você recebe o aviso no WhatsApp.'}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn btn-ghost" href={gcal} target="_blank" rel="noreferrer">
            <Icon name="calendar-plus" size={16} /> Adicionar à agenda
          </a>
          <a className="btn btn-primary" href={`/a/${done.token}`}>
            Ver meu agendamento
          </a>
        </div>
        {!props.loggedIn ? (
          <p className="muted xs">
            Quer ver seu histórico? <a href={`/cadastro?tipo=cliente&next=/meus-agendamentos`}>Crie uma conta</a> com o mesmo WhatsApp.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stack">
      <StepPills steps={steps} current={step} onSelect={setStep} />
      {error ? (
        <div className="toast toast-error notice" role="alert">
          <Icon name="error-circle" size={18} />
          {error}
        </div>
      ) : null}

      {current === 'services' ? (
        <div className="stack-sm">
          <h2 className="section-title">Escolha os serviços</h2>
          <p className="muted sm-text">Você pode somar mais de um (ex.: corte + barba).</p>
          <div className="book-service-list">
            {props.services.map((s) => (
              <ServiceCard
                key={s.id}
                name={s.name}
                description={s.description}
                duration={formatDuration(s.durationMinutes)}
                price={formatBRL(s.priceCents)}
                icon={s.icon}
                active={serviceIds.includes(s.id)}
                onClick={() => {
                  setServiceIds((xs) => (xs.includes(s.id) ? xs.filter((x) => x !== s.id) : [...xs, s.id]));
                  setTime(null);
                }}
              />
            ))}
          </div>
          {serviceIds.length > 0 && able.length === 0 ? <p className="field-error">Nenhum profissional faz todos esses serviços juntos. Tire algum.</p> : null}
        </div>
      ) : null}

      {current === 'pro' ? (
        <div className="stack-sm">
          <h2 className="section-title">Com quem?</h2>
          <div className="book-grid-barbers">
            <BarberCard name="Sem preferência" badge="Primeiro livre" active={pro === 'any'} onClick={() => { setPro('any'); setTime(null); }} />
            {able.map((p) => (
              <BarberCard key={p.id} name={p.name} badge={p.badge} picture={p.picture} active={pro === p.id} onClick={() => { setPro(p.id); setTime(null); }} />
            ))}
          </div>
        </div>
      ) : null}

      {current === 'date' ? (
        <div className="stack-sm">
          <h2 className="section-title">Escolha o dia</h2>
          <MiniCalendar
            selected={date ?? undefined}
            today={props.today}
            minDate={props.today}
            maxDate={props.maxDate}
            isDisabled={(d) => !workingDays.has(weekdayOf(d))}
            onSelect={(d) => {
              setDate(d);
              setTime(null);
            }}
          />
        </div>
      ) : null}

      {current === 'time' && date ? (
        <div className="stack-sm">
          <h2 className="section-title">
            {weekdayLong(date)}, {formatDateBR(date)}
          </h2>
          {slots === null ? (
            <p className="muted">Buscando horários...</p>
          ) : slots.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="time-five" size={20} /></div>
              <p className="empty-title">Nenhum horário disponível</p>
              <p className="empty-text">Tente selecionar outra data ou entre na fila de espera: se alguém desmarcar, você recebe um aviso no WhatsApp.</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Button variant="ghost" onClick={() => go('date')}>Outra data</Button>
                <Button icon="list-ul" onClick={() => setWaitOpen(true)}>Entrar na fila</Button>
              </div>
            </div>
          ) : (
            <TimeSlots
              groups={groupByPeriod(slots.map((s) => hhmmToMinute(s)!)).map((g) => ({
                label: PERIOD_LABELS[g.period],
                icon: PERIOD_ICONS[g.period],
                slots: g.slots.map((m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`),
              }))}
              value={time ?? undefined}
              onChange={setTime}
            />
          )}
        </div>
      ) : null}

      {current === 'confirm' ? (
        <div className="stack">
          <h2 className="section-title">Seus dados</h2>
          <div className="form-grid">
            <Field label="Nome *" id="bk-name">
              <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="WhatsApp *" id="bk-phone" hint="Para confirmação e lembrete.">
              <Input id="bk-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(11) 98765-4321" />
            </Field>
          </div>
          <Field label="Observação" id="bk-notes">
            <Textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </Field>
          <Field label="Código de indicação" id="bk-ref" hint="Se um amigo te indicou.">
            <Input id="bk-ref" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="Opcional" />
          </Field>
          {!props.loggedIn ? (
            <p className="muted xs">
              Não precisa de conta. Já tem? <a href={`/entrar?next=/${props.slug}`}>Entre</a> para ver seu histórico.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="bp-summary-card card stack-sm">
        <Summary chosen={chosen} pro={pro === 'any' ? 'Sem preferência' : props.professionals.find((p) => p.id === pro)?.name} date={date} time={time} total={total} duration={duration} />
      </div>

      <div className="row-between">
        {step > 0 ? (
          <Button variant="ghost" icon="left-arrow-alt" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        {current === 'confirm' ? (
          <Button size="lg" icon="check" disabled={busy || !name || !phone} onClick={confirm}>
            {busy ? 'Agendando...' : 'Confirmar agendamento'}
          </Button>
        ) : (
          <Button size="lg" disabled={!canNext} onClick={next}>
            Continuar
          </Button>
        )}
      </div>

      <div className="bp-mobile-cta">
        <div className="grow">
          <div className="strong">{chosen.length ? formatBRL(total) : 'Escolha um serviço'}</div>
          <div className="muted xs">{chosen.length ? `${formatDuration(duration)}${date ? ` · ${formatDateBR(date).slice(0, 5)}` : ''}${time ? ` às ${time}` : ''}` : ''}</div>
        </div>
        {current === 'confirm' ? (
          <Button size="lg" disabled={busy || !name || !phone} onClick={confirm}>
            {busy ? 'Agendando...' : 'Confirmar'}
          </Button>
        ) : (
          <Button size="lg" disabled={!canNext} onClick={next}>
            Continuar
          </Button>
        )}
      </div>

      {waitOpen ? (
        <Modal title="Fila de espera" eyebrow={date ? formatDateBR(date) : undefined} onClose={() => { setWaitOpen(false); setWaitDone(null); }}
          footer={waitDone === null ? (
            <Button disabled={busy} onClick={async () => {
              setBusy(true);
              const r = await joinWaitlistAction({ slug: props.slug, date: date!, professionalId: pro, serviceIds, name, phone });
              setBusy(false);
              if (r.ok) setWaitDone(r.ahead);
              else setError(r.error);
            }}>{busy ? 'Entrando...' : 'Entrar na fila'}</Button>
          ) : <Button onClick={() => { setWaitOpen(false); setWaitDone(null); }}>Fechar</Button>}
        >
          {waitDone === null ? (
            <div className="stack">
              <p className="sm-text">Se um horário vagar nesse dia, você recebe um aviso no WhatsApp.</p>
              <Field label="Nome" id="w-name"><Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="WhatsApp" id="w-phone"><Input id="w-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              {error ? <p className="field-error">{error}</p> : null}
            </div>
          ) : (
            <p>Pronto! {waitDone === 0 ? 'Você é o primeiro da fila.' : `Tem ${waitDone} ${waitDone === 1 ? 'pessoa' : 'pessoas'} na sua frente.`}</p>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

function Summary({ chosen, pro, date, time, total, duration }: { chosen: Service[]; pro?: string; date: string | null; time: string | null; total: number; duration: number }) {
  if (!chosen.length) return <p className="muted sm-text">Escolha um ou mais serviços para começar.</p>;
  return (
    <>
      <p className="field-label">Resumo</p>
      {chosen.map((s) => (
        <div key={s.id} className="bp-summary-row">
          <span>{s.name}</span>
          <span>{formatBRL(s.priceCents)}</span>
        </div>
      ))}
      {pro ? <div className="bp-summary-row"><span className="muted">Profissional</span><span>{pro}</span></div> : null}
      {date ? <div className="bp-summary-row"><span className="muted">Quando</span><span>{formatDateBR(date)}{time ? ` às ${time}` : ''}</span></div> : null}
      <div className="bp-summary-total">
        <span>Total · {formatDuration(duration)}</span>
        <span>{formatBRL(total)}</span>
      </div>
      <p className="muted xs">Pagamento na loja.</p>
    </>
  );
}
