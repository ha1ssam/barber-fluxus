'use client';
import { useEffect, useMemo, useState } from 'react';
import { checkoutAction, checkoutInfoAction, type CheckoutInfo } from '@/app/painel/(app)/agendamentos/actions';
import { Button, Field, Input, Select, Toggle } from '@/components/ui/basic';
import { Modal, PillTabs } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { formatBRL } from '@/lib/domain/money';

const METHODS = [
  { id: 'PIX', label: 'PIX' },
  { id: 'CASH', label: 'Dinheiro' },
  { id: 'CREDIT', label: 'Crédito' },
  { id: 'DEBIT', label: 'Débito' },
];

/** Concluir atendimento (com agendamento) ou venda avulsa de produtos (sem agendamento). */
export function CheckoutModal({ appointmentId, onClose }: { appointmentId: string | null; onClose: () => void }) {
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState('PIX');
  const [items, setItems] = useState<Record<string, number>>({});
  const [pick, setPick] = useState('');
  const [coupon, setCoupon] = useState('');
  const [redeem, setRedeem] = useState(false);
  const { run, pending } = useAction();

  useEffect(() => {
    checkoutInfoAction(appointmentId).then((r) => (r.ok ? setInfo(r.data!) : setLoadError(r.error)));
  }, [appointmentId]);

  const subtotal = useMemo(() => {
    if (!info) return 0;
    const svc = info.appointment?.services.reduce((s, x) => s + x.priceCents, 0) ?? 0;
    const prod = Object.entries(items).reduce((s, [id, q]) => s + (info.products.find((p) => p.id === id)?.priceCents ?? 0) * q, 0);
    return svc + prod;
  }, [info, items]);

  const title = appointmentId ? 'Concluir atendimento' : 'Nova venda';
  return (
    <Modal
      title={title}
      eyebrow="Caixa"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="confirm"
            icon="check"
            disabled={pending || !info || subtotal === 0}
            onClick={() =>
              run(
                () =>
                  checkoutAction({
                    appointmentId,
                    products: Object.entries(items).map(([productId, quantity]) => ({ productId, quantity })),
                    paymentMethod: method as 'PIX',
                    couponCode: coupon || undefined,
                    redeemReward: redeem,
                  }),
                { onSuccess: onClose },
              )
            }
          >
            {pending ? 'Salvando...' : appointmentId ? 'Concluir e receber' : 'Registrar venda'}
          </Button>
        </>
      }
    >
      {loadError ? <p className="danger-text">{loadError}</p> : null}
      {!info ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="stack">
          {info.appointment ? (
            <div>
              <p className="field-label">{info.appointment.clientName}</p>
              {info.appointment.services.map((s) => (
                <div key={s.name} className="bp-summary-row">
                  <span>{s.name}</span>
                  <span>{formatBRL(s.priceCents)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="stack-sm">
            <span className="field-label">Produtos</span>
            {Object.entries(items).map(([id, q]) => {
              const p = info.products.find((x) => x.id === id)!;
              return (
                <div key={id} className="row-between">
                  <span>{p.name}</span>
                  <div className="row">
                    <Button size="sm" variant="ghost" aria-label="Menos" onClick={() => setItems((xs) => { const n = { ...xs }; if (n[id] <= 1) delete n[id]; else n[id]--; return n; })}>
                      −
                    </Button>
                    <span className="strong">{q}</span>
                    <Button size="sm" variant="ghost" aria-label="Mais" onClick={() => setItems((xs) => ({ ...xs, [id]: xs[id] + 1 }))}>
                      +
                    </Button>
                    <span className="nowrap" style={{ minWidth: 80, textAlign: 'right' }}>
                      {formatBRL(p.priceCents * q)}
                    </span>
                  </div>
                </div>
              );
            })}
            {info.products.length ? (
              <div className="row">
                <Select
                  aria-label="Adicionar produto"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  options={[{ value: '', label: 'Adicionar produto...' }, ...info.products.map((p) => ({ value: p.id, label: `${p.name} · ${formatBRL(p.priceCents)}` }))]}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="ghost"
                  icon="plus"
                  disabled={!pick}
                  onClick={() => {
                    setItems((xs) => ({ ...xs, [pick]: (xs[pick] ?? 0) + 1 }));
                    setPick('');
                  }}
                >
                  Adicionar
                </Button>
              </div>
            ) : (
              <span className="field-hint">Cadastre produtos em Produtos para vender no caixa.</span>
            )}
          </div>
          <div className="stack-sm">
            <span className="field-label">Forma de pagamento</span>
            <PillTabs items={METHODS} value={method} onChange={setMethod} />
          </div>
          <div className="form-grid">
            <Field label="Cupom" id="coupon">
              <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Opcional" />
            </Field>
            {info.client && info.loyalty.enabled ? (
              <div className="field">
                <span className="field-label">Fidelidade</span>
                {info.client.hasReward ? (
                  <Toggle label={`Usar prêmio: ${info.loyalty.reward}`} checked={redeem} onChange={(e) => setRedeem(e.target.checked)} />
                ) : (
                  <span className="field-hint" style={{ paddingTop: 8 }}>
                    {info.client.stamps} de {info.loyalty.required} selos{appointmentId ? ' (+1 ao concluir)' : ''}
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <div className="bp-summary-total">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          {coupon || redeem ? <span className="field-hint">Descontos do cupom e da fidelidade são calculados ao salvar.</span> : null}
        </div>
      )}
    </Modal>
  );
}
