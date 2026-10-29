'use client';
import { usePathname, useRouter } from 'next/navigation';
import { Field, Input, Select } from '@/components/ui/basic';

export function AppointmentFilters({ values, professionals }: { values: Record<string, string>; professionals: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const set = (k: string, v: string) => {
    const q = new URLSearchParams(values);
    if (v) q.set(k, v);
    else q.delete(k);
    router.replace(`${pathname}?${q}`);
  };
  return (
    <div className="toolbar">
      <Field label="De" id="de">
        <Input id="de" type="date" value={values.de} onChange={(e) => set('de', e.target.value)} />
      </Field>
      <Field label="Até" id="ate">
        <Input id="ate" type="date" value={values.ate} onChange={(e) => set('ate', e.target.value)} />
      </Field>
      <Field label="Status" id="status">
        <Select
          id="status"
          value={values.status}
          onChange={(e) => set('status', e.target.value)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'PENDING', label: 'Pendente' },
            { value: 'CONFIRMED', label: 'Confirmado' },
            { value: 'COMPLETED', label: 'Concluído' },
            { value: 'CANCELLED', label: 'Cancelado' },
            { value: 'NO_SHOW', label: 'Não compareceu' },
          ]}
        />
      </Field>
      <Field label="Período" id="periodo">
        <Select
          id="periodo"
          value={values.periodo}
          onChange={(e) => set('periodo', e.target.value)}
          options={[
            { value: '', label: 'Dia todo' },
            { value: 'manha', label: 'Manhã' },
            { value: 'tarde', label: 'Tarde' },
            { value: 'noite', label: 'Noite' },
          ]}
        />
      </Field>
      <Field label="Ordenar por" id="ordem">
        <Select
          id="ordem"
          value={values.ordem}
          onChange={(e) => set('ordem', e.target.value)}
          options={[
            { value: 'data', label: 'Data' },
            { value: 'cliente', label: 'Cliente' },
            { value: 'servico', label: 'Serviço' },
            { value: 'recentes', label: 'Reservados por último' },
          ]}
        />
      </Field>
      {professionals.length > 1 ? (
        <Field label="Profissional" id="profissional">
          <Select id="profissional" value={values.profissional} onChange={(e) => set('profissional', e.target.value)} options={[{ value: '', label: 'Todos' }, ...professionals]} />
        </Field>
      ) : null}
    </div>
  );
}
