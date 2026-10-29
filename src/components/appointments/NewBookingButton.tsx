'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/basic';
import { ManualBookingModal, type ScheduleOptions } from './ScheduleModal';

export function NewBookingButton({ options, defaultProfessionalId, defaultDate }: { options: ScheduleOptions; defaultProfessionalId: string; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  if (!defaultProfessionalId) return null;
  return (
    <>
      <Button icon="calendar-plus" onClick={() => setOpen(true)}>
        Agendar manual
      </Button>
      {open ? <ManualBookingModal options={options} defaultProfessionalId={defaultProfessionalId} defaultDate={defaultDate} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
