'use client';
import { useState } from 'react';
import { createCouponAction, saveLoyaltyAction, toggleCouponAction } from './actions';
import { Button, Field, Input, Select, Toggle } from '@/components/ui/basic';
import { useAction } from '@/components/use-action';
import { parseBRL } from '@/lib/domain/money';

type Config = { loyaltyEnabled: boolean; loyaltyStampsRequired: number; loyaltyReward: string; referralEnabled: boolean; referralBonusStamps: number };

export function LoyaltyConfigForm({ initial }: { initial: Config }) {
  const [c, setC] = useState(initial);
  const { run, pending } = useAction();
  return (
    <div className="stack">
      <Toggle label="Cartão fidelidade ligado" checked={c.loyaltyEnabled} onChange={(e) => setC({ ...c, loyaltyEnabled: e.target.checked })} />
      <div className="form-grid">
        <Field label="Selos para o prêmio" id="req" hint="1 selo por atendimento concluído.">
          <Input id="req" type="number" min={2} max={50} value={c.loyaltyStampsRequired} onChange={(e) => setC({ ...c, loyaltyStampsRequired: Number(e.target.value) })} />
        </Field>
        <Field label="Prêmio" id="reward" hint="No caixa, o prêmio desconta o serviço mais caro.">
          <Input id="reward" value={c.loyaltyReward} onChange={(e) => setC({ ...c, loyaltyReward: e.target.value })} />
        </Field>
      </div>
      <hr className="divider" />
      <Toggle label="Programa de indicação ligado" checked={c.referralEnabled} onChange={(e) => setC({ ...c, referralEnabled: e.target.checked })} />
      <Field label="Selos ganhos por indicação" id="bonus" hint="Quem indicou ganha quando o indicado conclui o primeiro atendimento.">
        <Input id="bonus" type="number" min={0} max={10} value={c.referralBonusStamps} onChange={(e) => setC({ ...c, referralBonusStamps: Number(e.target.value) })} />
      </Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button disabled={pending} onClick={() => run(() => saveLoyaltyAction(c))}>
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

export function CouponForm() {
  const [code, setCode] = useState('');
  const [type, setType] = useState('PERCENT');
  const [value, setValue] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const { run, pending, error, setError } = useAction();
  return (
    <div className="stack-sm">
      <div className="toolbar">
        <Field label="Código" id="code">
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VOLTEI10" />
        </Field>
        <Field label="Tipo" id="type">
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'PERCENT', label: 'Percentual (%)' }, { value: 'FIXED', label: 'Valor (R$)' }]} />
        </Field>
        <Field label={type === 'PERCENT' ? 'Desconto (%)' : 'Desconto (R$)'} id="value">
          <Input id="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 120 }} />
        </Field>
        <Field label="Válido até" id="valid">
          <Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <Field label="Limite de usos" id="max">
          <Input id="max" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Sem limite" style={{ width: 130 }} />
        </Field>
        <Button
          icon="plus"
          disabled={pending}
          onClick={() => {
            const parsed = parseBRL(value);
            if (parsed === null) return setError('Desconto inválido.');
            // percentual em centésimos de %: "10" vira 1000
            const v = parsed;
            run(() => createCouponAction({ code, type: type as 'PERCENT', value: v, validUntil: validUntil || undefined, maxUses: maxUses ? Number(maxUses) : undefined }), {
              onSuccess: () => {
                setCode('');
                setValue('');
              },
            });
          }}
        >
          Criar cupom
        </Button>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const { run } = useAction();
  return <Toggle checked={active} onChange={(e) => run(() => toggleCouponAction(id, e.target.checked))} label={<span className="sr-only">Ativo</span>} />;
}
