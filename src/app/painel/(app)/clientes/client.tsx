'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adjustStampsAction, saveClientAction } from './actions';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/basic';
import { Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';

export function ClientFilters({ values, winbackDays }: { values: { q: string; filtro: string; ordem: string }; winbackDays: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(values.q);
  const push = (patch: Partial<typeof values>) => {
    const next = new URLSearchParams({ ...values, q, ...patch });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    router.replace(`${pathname}?${next}`);
  };
  useEffect(() => {
    const t = setTimeout(() => q !== values.q && push({ q }), 350);
    return () => clearTimeout(t);
  });
  return (
    <div className="toolbar">
      <Field label="Buscar" id="q">
        <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefone ou e-mail" style={{ minWidth: 240 }} />
      </Field>
      <Field label="Filtro" id="filtro">
        <Select
          id="filtro"
          value={values.filtro}
          onChange={(e) => push({ filtro: e.target.value })}
          options={[
            { value: '', label: 'Todos' },
            { value: 'com-email', label: 'Com e-mail' },
            { value: 'sem-email', label: 'Sem e-mail' },
            { value: 'aniversariantes', label: 'Aniversariantes do mês' },
            { value: 'sumidos', label: `Sumidos (+${winbackDays} dias)` },
          ]}
        />
      </Field>
      <Field label="Ordenar por" id="ordem">
        <Select
          id="ordem"
          value={values.ordem}
          onChange={(e) => push({ ordem: e.target.value })}
          options={[
            { value: 'nome', label: 'Nome' },
            { value: 'recentes', label: 'Mais recentes' },
            { value: 'agendamentos', label: 'Mais agendamentos' },
          ]}
        />
      </Field>
    </div>
  );
}

export interface ClientForm {
  id?: string;
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  notes: string;
}

export function ClientModal({ initial, onClose }: { initial?: ClientForm; onClose: () => void }) {
  const [f, setF] = useState<ClientForm>(initial ?? { name: '', phone: '', email: '', birthDate: '', notes: '' });
  const router = useRouter();
  const { run, pending, error } = useAction();
  const set = (k: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      title={f.id ? 'Editar cliente' : 'Novo cliente'}
      eyebrow="Clientes"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => saveClientAction(f), {
                onSuccess: (r) => {
                  onClose();
                  if (!f.id && r.data) router.push(`/painel/clientes/${r.data.id}`);
                },
              })
            }
          >
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <p className="field-error">{error}</p> : null}
        <Field label="Nome *" id="name">
          <Input id="name" value={f.name} onChange={set('name')} />
        </Field>
        <div className="form-grid">
          <Field label="Telefone *" id="phone">
            <Input id="phone" type="tel" value={f.phone} onChange={set('phone')} placeholder="(11) 98765-4321" />
          </Field>
          <Field label="Aniversário" id="birthDate">
            <Input id="birthDate" type="date" value={f.birthDate} onChange={set('birthDate')} />
          </Field>
        </div>
        <Field label="E-mail" id="email">
          <Input id="email" type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Observações" id="notes">
          <Textarea id="notes" rows={3} value={f.notes} onChange={set('notes')} placeholder="Ex.: prefere máquina 2" />
        </Field>
      </div>
    </Modal>
  );
}

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="user-plus" onClick={() => setOpen(true)}>
        Novo cliente
      </Button>
      {open ? <ClientModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditClientButton({ client }: { client: ClientForm }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" icon="edit" onClick={() => setOpen(true)}>
        Editar
      </Button>
      {open ? <ClientModal initial={client} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function StampButtons({ clientId }: { clientId: string }) {
  const { run, pending } = useAction();
  return (
    <div className="row">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adjustStampsAction(clientId, -1))} aria-label="Tirar um selo">
        −1
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adjustStampsAction(clientId, 1))} aria-label="Dar um selo">
        +1
      </Button>
    </div>
  );
}
