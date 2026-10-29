'use client';
import { useEffect, useMemo, useState } from 'react';
import { createManualAction, rescheduleAction, searchClientsAction, slotsAction } from '@/app/painel/(app)/agendamentos/actions';
import { Button, Checkbox, Field, Input, Select, Textarea, Toggle } from '@/components/ui/basic';
import { Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { formatBRL } from '@/lib/domain/money';
import { formatPhone } from '@/lib/domain/phone';
import { minuteToHHMM } from '@/lib/domain/time';

export interface ScheduleOptions {
  today: string;
  services: { id: string; name: string; priceCents: number; durationMinutes: number }[];
  professionals: { id: string; name: string; serviceIds: string[] }[];
}

function useSlots(professionalId: string, date: string, duration: number, excludeId?: string) {
  const [slots, setSlots] = useState<number[] | null>(null);
  useEffect(() => {
    let alive = true;
    setSlots(null);
    if (!professionalId || !date || duration <= 0) return;
    slotsAction(professionalId, date, duration, excludeId).then((r) => alive && setSlots(r.ok ? r.data! : []));
    return () => {
      alive = false;
    };
  }, [professionalId, date, duration, excludeId]);
  return slots;
}

function TimePicker({ slots, value, onChange, free, setFree }: { slots: number[] | null; value: string; onChange: (v: string) => void; free: boolean; setFree: (v: boolean) => void }) {
  return (
    <div className="stack-sm">
      {free ? (
        <Field label="Horário (encaixe)" id="time">
          <Input id="time" type="time" value={value} onChange={(e) => onChange(e.target.value)} step={300} required />
        </Field>
      ) : (
        <Field label="Horário" id="time">
          <Select
            id="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={
              slots === null
                ? [{ value: '', label: 'Carregando...' }]
                : slots.length === 0
                  ? [{ value: '', label: 'Nenhum horário disponível' }]
                  : [{ value: '', label: 'Escolha o horário' }, ...slots.map((s) => ({ value: minuteToHHMM(s), label: minuteToHHMM(s) }))]
            }
          />
        </Field>
      )}
      <Toggle label="Encaixe fora da grade ou do expediente" checked={free} onChange={(e) => setFree(e.target.checked)} />
    </div>
  );
}

export function ManualBookingModal({
  options,
  defaultProfessionalId,
  defaultDate,
  defaultTime,
  onClose,
}: {
  options: ScheduleOptions;
  defaultProfessionalId: string;
  defaultDate: string;
  defaultTime?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? '');
  const [free, setFree] = useState(false);
  const [notes, setNotes] = useState('');
  const { run, pending, error } = useAction();

  const chosen = options.services.filter((s) => serviceIds.includes(s.id));
  const duration = chosen.reduce((s, x) => s + x.durationMinutes, 0);
  const price = chosen.reduce((s, x) => s + x.priceCents, 0);
  const pro = options.professionals.find((p) => p.id === professionalId);
  const slots = useSlots(professionalId, date, duration);

  useEffect(() => {
    if (slots && time && !free && !slots.map(minuteToHHMM).includes(time)) setTime('');
  }, [slots, time, free]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (name.length >= 2) searchClientsAction(name).then((r) => setSuggestions(r.ok ? r.data! : []));
      else setSuggestions([]);
    }, 250);
    return () => clearTimeout(t);
  }, [name]);

  return (
    <Modal
      title="Agendar manual"
      eyebrow="Agenda"
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            icon="calendar-plus"
            disabled={pending || !time || serviceIds.length === 0}
            onClick={() => run(() => createManualAction({ name, phone, serviceIds, professionalId, date, time, notes, allowOutsideHours: free }), { onSuccess: onClose })}
          >
            {pending ? 'Agendando...' : 'Agendar'}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <p className="field-error">{error}</p> : null}
        <div className="form-grid">
          <Field label="Cliente *" id="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} list="client-suggestions" autoComplete="off" placeholder="Nome do cliente" />
            <datalist id="client-suggestions">
              {suggestions.map((s) => (
                <option key={s.id} value={s.name}>
                  {formatPhone(s.phone)}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Telefone *" id="phone" hint={suggestions.find((s) => s.name === name) ? 'Cliente já cadastrado.' : undefined}>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onFocus={() => {
                const match = suggestions.find((s) => s.name === name);
                if (match && !phone) setPhone(formatPhone(match.phone));
              }}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </Field>
        </div>
        {options.professionals.length > 1 ? (
          <Field label="Profissional" id="pro">
            <Select id="pro" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} options={options.professionals.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
        ) : null}
        <div className="stack-sm">
          <span className="field-label">Serviços *</span>
          <div className="check-grid">
            {options.services
              .filter((s) => !pro || pro.serviceIds.includes(s.id))
              .map((s) => (
                <Checkbox
                  key={s.id}
                  label={`${s.name} · ${formatBRL(s.priceCents)}`}
                  checked={serviceIds.includes(s.id)}
                  onChange={(e) => setServiceIds((xs) => (e.target.checked ? [...xs, s.id] : xs.filter((x) => x !== s.id)))}
                />
              ))}
          </div>
          {chosen.length ? (
            <span className="field-hint">
              {duration} min · {formatBRL(price)}
            </span>
          ) : null}
        </div>
        <div className="form-grid">
          <Field label="Data" id="date">
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <TimePicker slots={duration ? slots : []} value={time} onChange={setTime} free={free} setFree={setFree} />
        </div>
        <Field label="Observações" id="notes">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex.: prefere máquina 2" />
        </Field>
      </div>
    </Modal>
  );
}

export function RescheduleModal({
  options,
  appointment,
  onClose,
}: {
  options: ScheduleOptions;
  appointment: { id: string; professionalId: string; date: string; time: string; durationMinutes: number; clientName: string };
  onClose: () => void;
}) {
  const [professionalId, setProfessionalId] = useState(appointment.professionalId);
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState('');
  const [free, setFree] = useState(false);
  const slots = useSlots(professionalId, date, appointment.durationMinutes, appointment.id);
  const { run, pending, error } = useAction();
  const pros = useMemo(() => options.professionals, [options.professionals]);
  return (
    <Modal
      title={`Remarcar ${appointment.clientName}`}
      eyebrow="Agenda"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={pending || !time} onClick={() => run(() => rescheduleAction({ appointmentId: appointment.id, date, time, professionalId, allowOutsideHours: free }), { onSuccess: onClose })}>
            {pending ? 'Salvando...' : 'Remarcar'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted sm-text">
          Atual: {appointment.date.split('-').reverse().join('/')} às {appointment.time} · {appointment.durationMinutes} min
        </p>
        {error ? <p className="field-error">{error}</p> : null}
        {pros.length > 1 ? (
          <Field label="Profissional" id="pro">
            <Select id="pro" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} options={pros.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
        ) : null}
        <Field label="Nova data" id="date">
          <Input id="date" type="date" value={date} min={options.today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <TimePicker slots={slots} value={time} onChange={setTime} free={free} setFree={setFree} />
      </div>
    </Modal>
  );
}
