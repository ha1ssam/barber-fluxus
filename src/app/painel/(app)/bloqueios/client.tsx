'use client';
import { useState } from 'react';
import { clearOldBlocksAction, createBlockAction, deleteBlockAction } from './actions';
import type { ScheduleOptions } from '@/components/appointments/ScheduleModal';
import { Button, Card, Field, Input, Select, Toggle } from '@/components/ui/basic';
import { useAction } from '@/components/use-action';

export function BlocksClient({
  options,
  rows,
  canEdit,
  canClear,
  showProfessional,
}: {
  options: ScheduleOptions;
  rows: { id: string; date: string; range: string; reason: string; professional: string }[];
  canEdit: boolean;
  canClear: boolean;
  showProfessional: boolean;
}) {
  const [pro, setPro] = useState(options.professionals[0]?.id ?? '');
  const [date, setDate] = useState(options.today);
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [allDay, setAllDay] = useState(false);
  const [reason, setReason] = useState('');
  const { run, pending } = useAction();
  return (
    <>
      {canEdit ? (
        <Card title="Novo bloqueio" actions={canClear ? <Button size="sm" variant="ghost" icon="trash" onClick={() => run(() => clearOldBlocksAction())}>Limpar antigos</Button> : undefined}>
          <div className="stack">
            <div className="form-grid">
              {showProfessional ? (
                <Field label="Profissional" id="pro">
                  <Select id="pro" value={pro} onChange={(e) => setPro(e.target.value)} options={options.professionals.map((p) => ({ value: p.id, label: p.name }))} />
                </Field>
              ) : null}
              <Field label="Data" id="date">
                <Input id="date" type="date" value={date} min={options.today} onChange={(e) => setDate(e.target.value)} />
              </Field>
              {!allDay ? (
                <>
                  <Field label="Início" id="start">
                    <Input id="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} step={300} />
                  </Field>
                  <Field label="Fim" id="end">
                    <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} step={300} />
                  </Field>
                </>
              ) : null}
              <Field label="Motivo" id="reason">
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Folga, médico, curso" />
              </Field>
            </div>
            <div className="row-between">
              <Toggle label="Dia todo" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              <Button icon="lock-alt" disabled={pending} onClick={() => run(() => createBlockAction({ professionalId: pro, date, start, end, reason, allDay }), { onSuccess: () => setReason('') })}>
                {pending ? 'Salvando...' : 'Bloquear'}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      {rows.length ? (
        <div className="table-wrap">
          <table className="fx-table responsive">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                {showProfessional ? <th>Profissional</th> : null}
                <th>Motivo</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Data" className="strong">{r.date}</td>
                  <td data-label="Horário">{r.range}</td>
                  {showProfessional ? <td data-label="Profissional">{r.professional}</td> : null}
                  <td data-label="Motivo">{r.reason}</td>
                  <td className="actions num">
                    {canEdit ? (
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => run(() => deleteBlockAction(r.id))}>
                        Remover
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
