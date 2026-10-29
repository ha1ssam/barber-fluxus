'use client';
import { useState } from 'react';
import { setStatusAction } from '@/app/painel/(app)/agendamentos/actions';
import { Button } from '@/components/ui/basic';
import { Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { CheckoutModal } from './CheckoutModal';
import { RescheduleModal, type ScheduleOptions } from './ScheduleModal';

export interface ApptRow {
  id: string;
  status: string;
  ended: boolean;
  professionalId: string;
  date: string;
  time: string;
  durationMinutes: number;
  clientName: string;
}

/** Botões de ação de um agendamento, conforme o status e o horário. */
export function AppointmentActions({ appt, options, compact }: { appt: ApptRow; options: ScheduleOptions; compact?: boolean }) {
  const { run, pending } = useAction();
  const [modal, setModal] = useState<null | 'checkout' | 'reschedule' | 'cancel'>(null);
  const active = appt.status === 'PENDING' || appt.status === 'CONFIRMED';
  const size = compact ? 'sm' : 'sm';
  return (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      {appt.status === 'PENDING' ? (
        <Button size={size} variant="confirm" icon="check" disabled={pending} onClick={() => run(() => setStatusAction(appt.id, 'CONFIRMED'))}>
          Confirmar
        </Button>
      ) : null}
      {(active || appt.status === 'NO_SHOW') && appt.ended ? (
        <Button size={size} variant="confirm" icon="check-double" onClick={() => setModal('checkout')}>
          Concluir
        </Button>
      ) : null}
      {active && appt.ended ? (
        <Button size={size} variant="ghost" disabled={pending} onClick={() => run(() => setStatusAction(appt.id, 'NO_SHOW'))}>
          Faltou
        </Button>
      ) : null}
      {active && !appt.ended ? (
        <Button size={size} variant="ghost" icon="calendar-event" onClick={() => setModal('reschedule')}>
          Remarcar
        </Button>
      ) : null}
      {active ? (
        <Button size={size} variant="ghost" icon="x" onClick={() => setModal('cancel')} aria-label={appt.status === 'PENDING' ? 'Recusar' : 'Cancelar'}>
          {appt.status === 'PENDING' ? 'Recusar' : 'Cancelar'}
        </Button>
      ) : null}
      {modal === 'checkout' ? <CheckoutModal appointmentId={appt.id} onClose={() => setModal(null)} /> : null}
      {modal === 'reschedule' ? <RescheduleModal options={options} appointment={appt} onClose={() => setModal(null)} /> : null}
      {modal === 'cancel' ? (
        <Modal
          title={appt.status === 'PENDING' ? 'Recusar reserva?' : 'Cancelar agendamento?'}
          eyebrow="Confirmação"
          danger
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(null)}>
                Voltar
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => run(() => setStatusAction(appt.id, 'CANCELLED'), { onSuccess: () => setModal(null) })}>
                {pending ? 'Cancelando...' : appt.status === 'PENDING' ? 'Recusar' : 'Cancelar agendamento'}
              </Button>
            </>
          }
        >
          {appt.clientName} recebe um aviso no WhatsApp (se a loja estiver conectada). O horário volta a ficar livre.
        </Modal>
      ) : null}
    </div>
  );
}
