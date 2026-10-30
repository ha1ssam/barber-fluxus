'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { addMovementAction, closeRegisterAction, deleteSaleAction, openRegisterAction } from './actions';
import { CheckoutModal } from '@/components/appointments/CheckoutModal';
import { Button, Field, IconButton, Input, Textarea } from '@/components/ui/basic';
import { Modal, PillTabs } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { formatBRL, parseBRL } from '@/lib/domain/money';
import { addDays } from '@/lib/domain/time';

export function DateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (d: string) => router.push(`${pathname}?data=${d}`);
  return (
    <div className="row">
      <IconButton icon="chevron-left" label="Dia anterior" onClick={() => go(addDays(date, -1))} />
      <Input type="date" value={date} max={today} onChange={(e) => e.target.value && go(e.target.value)} className="input-date-nav" aria-label="Data" />
      <IconButton icon="chevron-right" label="Próximo dia" onClick={() => date < today && go(addDays(date, 1))} />
      <Button size="sm" variant="ghost" disabled={date === today} onClick={() => go(today)}>
        Hoje
      </Button>
    </div>
  );
}

export function CashActions({ registerOpen, expectedCash, isToday }: { registerOpen: boolean; expectedCash: number | null; isToday: boolean }) {
  const [modal, setModal] = useState<null | 'sale' | 'movement' | 'open' | 'close'>(null);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('EXPENSE');
  const { run, pending, error, setError } = useAction();
  const close = () => {
    setModal(null);
    setAmount('');
    setDesc('');
    setError(null);
  };
  const cents = () => {
    const v = parseBRL(amount || '0');
    if (v === null) setError('Valor inválido. Ex.: 50,00');
    return v;
  };
  if (!isToday) return null;
  return (
    <>
      <Button variant="ghost" icon="receipt" onClick={() => setModal('movement')}>
        Lançamento
      </Button>
      {registerOpen ? (
        <Button variant="ghost" icon="lock-alt" onClick={() => setModal('close')}>
          Fechar caixa
        </Button>
      ) : (
        <Button variant="ghost" icon="lock-open-alt" onClick={() => setModal('open')}>
          Abrir caixa
        </Button>
      )}
      <Button icon="plus" onClick={() => setModal('sale')}>
        Nova venda
      </Button>
      {modal === 'sale' ? <CheckoutModal appointmentId={null} onClose={close} /> : null}
      {modal === 'open' ? (
        <Modal
          title="Abrir caixa"
          eyebrow="Caixa"
          onClose={close}
          footer={
            <Button disabled={pending} onClick={() => { const v = cents(); if (v !== null) run(() => openRegisterAction(v), { onSuccess: close }); }}>
              Abrir
            </Button>
          }
        >
          <Field label="Troco inicial (R$)" id="amount" error={error ?? undefined}>
            <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100,00" />
          </Field>
        </Modal>
      ) : null}
      {modal === 'close' ? (
        <Modal
          title="Fechar caixa"
          eyebrow="Caixa"
          onClose={close}
          footer={
            <Button disabled={pending} onClick={() => { const v = cents(); if (v !== null) run(() => closeRegisterAction(v, desc), { onSuccess: close }); }}>
              Fechar caixa
            </Button>
          }
        >
          <div className="stack">
            <p className="sm-text">Esperado na gaveta: <span className="strong">{formatBRL(expectedCash ?? 0)}</span></p>
            <Field label="Valor contado (R$)" id="amount" error={error ?? undefined}>
              <Input id="amount" placeholder="0,00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Observações" id="notes">
              <Textarea id="notes" placeholder="Ex.: faltou troco de R$ 5,00" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </Field>
          </div>
        </Modal>
      ) : null}
      {modal === 'movement' ? (
        <Modal
          title="Novo lançamento"
          eyebrow="Caixa"
          onClose={close}
          footer={
            <Button disabled={pending} onClick={() => { const v = cents(); if (v !== null) run(() => addMovementAction({ type: type as 'EXPENSE', amountCents: v, description: desc }), { onSuccess: close }); }}>
              Lançar
            </Button>
          }
        >
          <div className="stack">
            <PillTabs
              items={[
                { id: 'EXPENSE', label: 'Despesa' },
                { id: 'WITHDRAWAL', label: 'Sangria' },
                { id: 'DEPOSIT', label: 'Suprimento' },
              ]}
              value={type}
              onChange={setType}
            />
            {error ? <p className="field-error">{error}</p> : null}
            <Field label="Valor (R$)" id="amount">
              <Input id="amount" placeholder="0,00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Descrição" id="desc">
              <Input id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={type === 'EXPENSE' ? 'Ex.: produtos de limpeza' : type === 'WITHDRAWAL' ? 'Ex.: depósito no banco' : 'Ex.: troco extra'} />
            </Field>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function DeleteSaleButton({ saleId }: { saleId: string }) {
  const [confirm, setConfirm] = useState(false);
  const { run, pending } = useAction();
  return (
    <>
      <IconButton icon="trash" label="Estornar venda" onClick={() => setConfirm(true)} />
      {confirm ? (
        <Modal
          title="Estornar venda?"
          eyebrow="Caixa"
          danger
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Voltar
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => run(() => deleteSaleAction(saleId), { onSuccess: () => setConfirm(false) })}>
                Estornar
              </Button>
            </>
          }
        >
          A venda sai do faturamento. Se veio de um atendimento, ele volta para confirmado.
        </Modal>
      ) : null}
    </>
  );
}
