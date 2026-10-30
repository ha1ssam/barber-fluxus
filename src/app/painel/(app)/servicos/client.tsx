'use client';
import { useEffect, useState } from 'react';
import { marketPriceAction, moveServiceAction, saveServiceAction, toggleServiceAction } from './actions';
import { Button, Checkbox, EmptyState, Field, IconButton, Input, Select, Textarea, Toggle } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { CATEGORY_ICONS, CATEGORY_LABELS, formatDuration } from '@/lib/domain/labels';
import { formatBRL, parseBRL } from '@/lib/domain/money';

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceCents: number;
  durationMinutes: number;
  active: boolean;
  professionalIds: string[];
}

export function ServicesClient({ services, professionals, canEdit }: { services: Service[]; professionals: { id: string; name: string }[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<Service | null | 'new'>(null);
  const { run, pending } = useAction();
  return (
    <>
      {canEdit ? (
        <div className="row-between">
          <p className="muted sm-text">O cliente pode somar vários serviços num horário só. Preço e duração viram a soma.</p>
          <Button icon="plus" onClick={() => setEditing('new')}>
            Novo serviço
          </Button>
        </div>
      ) : null}
      {services.length === 0 ? (
        <EmptyState icon="cut" title="Nenhum serviço cadastrado" text="Sem serviços, sua página não aceita reservas. Comece pelo corte." action={canEdit ? <Button onClick={() => setEditing('new')}>Cadastrar serviço</Button> : undefined} />
      ) : (
        <div className="table-wrap">
          <table className="fx-table responsive">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Tipo</th>
                <th className="num">Duração</th>
                <th className="num">Preço</th>
                {professionals.length > 1 ? <th>Quem faz</th> : null}
                <th>Ativo</th>
                {canEdit ? <th className="num">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={s.id} style={{ opacity: s.active ? 1 : 0.6 }}>
                  <td data-label="Serviço">
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Icon name={CATEGORY_ICONS[s.category] ?? 'cut'} size={18} style={{ color: 'var(--text-secondary)' }} />
                      <div>
                        <div className="strong">{s.name}</div>
                        {s.description ? <div className="muted xs">{s.description}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td data-label="Tipo">{CATEGORY_LABELS[s.category]}</td>
                  <td data-label="Duração" className="num">{formatDuration(s.durationMinutes)}</td>
                  <td data-label="Preço" className="num price-text">{formatBRL(s.priceCents)}</td>
                  {professionals.length > 1 ? (
                    <td data-label="Quem faz" className="xs">{s.professionalIds.length === professionals.length ? 'Todos' : professionals.filter((p) => s.professionalIds.includes(p.id)).map((p) => p.name.split(' ')[0]).join(', ')}</td>
                  ) : null}
                  <td data-label="Ativo">{canEdit ? <Toggle checked={s.active} onChange={(e) => run(() => toggleServiceAction(s.id, e.target.checked))} label={<span className="sr-only">Ativo</span>} /> : s.active ? 'Sim' : 'Não'}</td>
                  {canEdit ? (
                    <td className="actions num">
                      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <IconButton icon="chevron-up" label="Subir" onClick={() => !pending && i > 0 && run(() => moveServiceAction(s.id, -1))} />
                        <IconButton icon="chevron-down" label="Descer" onClick={() => !pending && run(() => moveServiceAction(s.id, 1))} />
                        <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(s)}>
                          Editar
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? <ServiceModal service={editing === 'new' ? null : editing} professionals={professionals} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function ServiceModal({ service, professionals, onClose }: { service: Service | null; professionals: { id: string; name: string }[]; onClose: () => void }) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [category, setCategory] = useState(service?.category ?? 'HAIRCUT');
  const [price, setPrice] = useState(service ? (service.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [active, setActive] = useState(service?.active ?? true);
  const [pros, setPros] = useState<string[]>(service?.professionalIds ?? professionals.map((p) => p.id));
  const [market, setMarket] = useState<{ avgCents: number; scope: string; shops: number } | null | undefined>(undefined);
  const { run, pending, error, setError } = useAction();

  useEffect(() => {
    setMarket(undefined);
    marketPriceAction(category).then((r) => setMarket(r.ok ? (r.data ?? null) : null));
  }, [category]);

  const submit = () => {
    const priceCents = parseBRL(price);
    if (priceCents === null) return setError('Preço inválido. Ex.: 45,00');
    run(() => saveServiceAction({ id: service?.id, name, description, category: category as 'HAIRCUT', priceCents, durationMinutes: Number(duration), active, professionalIds: pros }), { onSuccess: onClose });
  };

  return (
    <Modal
      title={service ? 'Editar serviço' : 'Novo serviço'}
      eyebrow="Serviços"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <p className="field-error">{error}</p> : null}
        <Field label="Nome *" id="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte degradê" />
        </Field>
        <Field label="Descrição" id="description">
          <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aparece na sua página" />
        </Field>
        <Field label="Tipo" id="category">
          <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)} options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
        </Field>
        <div className="form-grid">
          <Field
            label="Preço (R$) *"
            id="price"
            hint={market === undefined ? 'Buscando preço médio...' : market ? `Preço médio ${market.scope}: ${formatBRL(market.avgCents)} (${market.shops} lojas)` : 'Ainda não há lojas suficientes na região para comparar.'}
          >
            <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45,00" />
          </Field>
          <Field label="Duração (min) *" id="duration" hint="Mínimo 10, em múltiplos de 5.">
            <Input id="duration" placeholder="30" type="number" min={10} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        {professionals.length > 1 ? (
          <div className="stack-sm">
            <span className="field-label">Quem faz</span>
            <div className="check-grid">
              {professionals.map((p) => (
                <Checkbox key={p.id} label={p.name} checked={pros.includes(p.id)} onChange={(e) => setPros((xs) => (e.target.checked ? [...xs, p.id] : xs.filter((x) => x !== p.id)))} />
              ))}
            </div>
          </div>
        ) : null}
        <Toggle label="Ativo (aparece na página de agendamento)" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
    </Modal>
  );
}
