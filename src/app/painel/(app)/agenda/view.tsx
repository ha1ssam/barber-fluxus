'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBlockAction, deleteBlockAction } from '../bloqueios/actions';
import { AppointmentActions } from '@/components/appointments/AppointmentActions';
import { ManualBookingModal, type ScheduleOptions } from '@/components/appointments/ScheduleModal';
import { Button, Card, Field, Input, Notice, Select, StatusBadge } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { MiniCalendar, Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { formatPhone, whatsappLink } from '@/lib/domain/phone';

export type AgendaRow =
  | { time: string; kind: 'free' | 'off' | 'lunch' | 'past' }
  | { time: string; kind: 'blocked'; label: string; blockId: string }
  | {
      time: string;
      kind: 'appointment';
      appointment: null | {
        id: string;
        status: string;
        clientName: string;
        phone: string;
        services: string;
        price: string;
        range: string;
        ended: boolean;
        durationMinutes: number;
        notes: string | null;
      };
    };

const SLOT_CLASS: Record<string, string> = {
  PENDING: 'slot-pending',
  CONFIRMED: 'slot-confirmed',
  COMPLETED: 'slot-completed',
  NO_SHOW: 'slot-blocked',
};

export function AgendaView({
  date,
  today,
  professionalId,
  canSwitch,
  canBlock,
  options,
  rows,
  summary,
  dayOff,
}: {
  date: string;
  today: string;
  professionalId: string;
  canSwitch: boolean;
  canBlock: boolean;
  options: ScheduleOptions;
  rows: AgendaRow[];
  summary: { booked: number; free: number; blocked: number };
  dayOff: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [booking, setBooking] = useState<string | null | false>(false);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [blockEnd, setBlockEnd] = useState('');
  const [reason, setReason] = useState('');
  const { run, pending } = useAction();
  const go = (d: string, p = professionalId) => router.push(`${pathname}?data=${d}&profissional=${p}`);

  return (
    <div className="agenda-layout">
      <div className="stack">
        <MiniCalendar selected={date} today={today} onSelect={(d) => go(d)} />
        <div className="row">
          <Button variant="ghost" size="sm" onClick={() => go(today)} disabled={date === today}>
            Hoje
          </Button>
          <Button size="sm" icon="calendar-plus" onClick={() => setBooking(null)}>
            Agendar manual
          </Button>
        </div>
        {canSwitch && options.professionals.length > 1 ? (
          <Field label="Profissional:" id="pro">
            <Select id="pro" value={professionalId} onChange={(e) => go(date, e.target.value)} options={options.professionals.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
        ) : null}
        <Card title="Resumo do dia">
          <div className="stack-sm sm-text">
            <div className="row-between">
              <span>Agendados</span>
              <span className="strong">{summary.booked}</span>
            </div>
            <div className="row-between">
              <span>Horários livres</span>
              <span className="strong success-text">{summary.free}</span>
            </div>
            <div className="row-between">
              <span>Bloqueados</span>
              <span className="strong danger-text">{summary.blocked}</span>
            </div>
          </div>
        </Card>
        <div className="legend">
          <span><i style={{ background: 'var(--success)' }} />Livre</span>
          <span><i style={{ background: 'var(--warning)' }} />Pendente</span>
          <span><i style={{ background: 'var(--brand)' }} />Confirmado</span>
          <span><i style={{ background: 'var(--danger)' }} />Bloqueado</span>
          <span><i style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }} />Fora do expediente</span>
        </div>
      </div>

      <div className="stack">
        {dayOff ? <Notice type="info">Sem expediente neste dia. Dá para agendar como encaixe.</Notice> : null}
        <div className="agenda-grid">
          {rows.map((r) => {
            if (r.kind === 'appointment') {
              if (!r.appointment) return null;
              const a = r.appointment;
              return (
                <div key={r.time} className="agenda-row">
                  <div className="agenda-time">{r.time}</div>
                  <div className={`agenda-cell ${SLOT_CLASS[a.status] ?? ''}`} style={{ flexWrap: 'wrap' }}>
                    <div className="grow">
                      <div className="row">
                        <span className="agenda-appt-name">{a.clientName}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="agenda-appt-meta">
                        {a.range} · {a.services} · {a.price}
                      </div>
                      {a.notes ? <div className="agenda-appt-meta">“{a.notes}”</div> : null}
                      <a className="xs" href={whatsappLink(a.phone)} target="_blank" rel="noreferrer">
                        <Icon name="whatsapp" size={12} /> {formatPhone(a.phone)}
                      </a>
                    </div>
                    <AppointmentActions
                      options={options}
                      appt={{ id: a.id, status: a.status, ended: a.ended, professionalId, date, time: a.range.slice(0, 5), durationMinutes: a.durationMinutes, clientName: a.clientName }}
                    />
                  </div>
                </div>
              );
            }
            if (r.kind === 'blocked') {
              return (
                <div key={r.time} className="agenda-row">
                  <div className="agenda-time">{r.time}</div>
                  <div className="agenda-cell slot-blocked">
                    <Icon name="lock-alt" size={14} />
                    <span className="grow">{r.label}</span>
                    {canBlock ? (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteBlockAction(r.blockId))}>
                        Desbloquear
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            }
            if (r.kind === 'free') {
              return (
                <div key={r.time} className="agenda-row">
                  <div className="agenda-time">{r.time}</div>
                  <div className="agenda-cell slot-free">
                    <span className="grow muted xs">Livre</span>
                    <button type="button" className="free-btn" onClick={() => setBooking(r.time)}>
                      + Agendar
                    </button>
                    {canBlock ? (
                      <button
                        type="button"
                        className="free-btn"
                        style={{ color: 'var(--danger-text)' }}
                        onClick={() => {
                          setBlocking(r.time);
                          setBlockEnd('');
                        }}
                      >
                        Bloquear
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            }
            return (
              <div key={r.time} className="agenda-row">
                <div className="agenda-time">{r.time}</div>
                <div className="agenda-cell slot-off">
                  <span className="xs">{r.kind === 'lunch' ? 'Intervalo' : r.kind === 'past' ? 'Horário já passou' : 'Fora do expediente'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {booking !== false ? (
        <ManualBookingModal options={options} defaultProfessionalId={professionalId} defaultDate={date} defaultTime={booking ?? undefined} onClose={() => setBooking(false)} />
      ) : null}
      {blocking ? (
        <Modal
          title={`Bloquear a partir das ${blocking}`}
          eyebrow="Bloqueio"
          onClose={() => setBlocking(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBlocking(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={pending || !blockEnd}
                onClick={() => run(() => createBlockAction({ professionalId, date, start: blocking, end: blockEnd, reason }), { onSuccess: () => setBlocking(null) })}
              >
                Bloquear
              </Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Até" id="end">
              <Input id="end" type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} min={blocking} step={300} />
            </Field>
            <Field label="Motivo (opcional)" id="reason">
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Folga, médico, curso" />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
