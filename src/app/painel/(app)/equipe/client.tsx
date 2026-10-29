'use client';
import { useState } from 'react';
import { inviteAction, removeMemberAction, revokeInviteAction, saveMemberAction, updateShopCommissionAction } from './actions';
import { Button, Field, Input, Select, Toggle } from '@/components/ui/basic';
import { CopyButton, Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { COMMISSION_LABELS } from '@/lib/domain/commission';
import { parseBRL } from '@/lib/domain/money';

type Member = {
  id: string;
  name: string;
  email: string;
  displayName: string;
  role: 'OWNER' | 'BARBER' | 'RECEPTIONIST';
  roleLabel: string;
  isProfessional: boolean;
  canManageOwnSchedule: boolean;
  canManageOwnServices: boolean;
  commissionType: string;
  commissionValue: number;
  commissionText: string;
};

const toInput = (type: string, v: number) => (type === 'PERCENT' ? String(v / 100).replace('.', ',') : (v / 100).toFixed(2).replace('.', ','));

export function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState(member);
  const [value, setValue] = useState(toInput(member.commissionType, member.commissionValue));
  const [confirm, setConfirm] = useState(false);
  const { run, pending, error, setError } = useAction();
  return (
    <tr>
      <td data-label="">
        <div className="strong">{member.name}{isSelf ? ' (você)' : ''}</div>
        <div className="muted xs">{member.email}</div>
      </td>
      <td data-label="Papel">{member.roleLabel}</td>
      <td data-label="Atende">{member.isProfessional ? 'Sim' : 'Não'}</td>
      <td data-label="Comissão" className="xs">{member.commissionText}</td>
      <td className="actions num">
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" icon="edit" onClick={() => setOpen(true)}>
            Editar
          </Button>
          {member.role !== 'OWNER' ? (
            <Button size="sm" variant="ghost" icon="user-x" onClick={() => setConfirm(true)}>
              Remover
            </Button>
          ) : null}
        </div>
        {confirm ? (
          <Modal
            title={`Remover ${member.name}?`}
            eyebrow="Equipe"
            danger
            onClose={() => setConfirm(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirm(false)}>Voltar</Button>
                <Button variant="danger" disabled={pending} onClick={() => run(() => removeMemberAction(member.id), { onSuccess: () => setConfirm(false) })}>Remover</Button>
              </>
            }
          >
            A pessoa perde o acesso à loja. O histórico de atendimentos e vendas continua salvo.
          </Modal>
        ) : null}
        {open ? (
          <Modal
            title={`Editar ${member.name}`}
            eyebrow="Equipe"
            onClose={() => setOpen(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button
                  disabled={pending}
                  onClick={() => {
                    let cv = 0;
                    if (m.commissionType !== 'DEFAULT' && m.commissionType !== 'NONE') {
                      const parsed = parseBRL(value);
                      if (parsed === null) return setError('Valor de comissão inválido.');
                      cv = parsed;
                    }
                    run(
                      () =>
                        saveMemberAction({
                          id: m.id,
                          displayName: m.displayName,
                          role: m.role,
                          isProfessional: m.isProfessional,
                          canManageOwnSchedule: m.canManageOwnSchedule,
                          canManageOwnServices: m.canManageOwnServices,
                          commissionType: m.commissionType as 'DEFAULT',
                          commissionValue: cv,
                        }),
                      { onSuccess: () => setOpen(false) },
                    );
                  }}
                >
                  Salvar
                </Button>
              </>
            }
          >
            <div className="stack" style={{ textAlign: 'left' }}>
              {error ? <p className="field-error">{error}</p> : null}
              <Field label="Nome na agenda e na página" id="dn">
                <Input id="dn" value={m.displayName} onChange={(e) => setM({ ...m, displayName: e.target.value })} placeholder={member.name} />
              </Field>
              {m.role !== 'OWNER' ? (
                <Field label="Papel" id="role">
                  <Select id="role" value={m.role} onChange={(e) => setM({ ...m, role: e.target.value as 'BARBER', isProfessional: e.target.value === 'BARBER' ? true : m.isProfessional })} options={[{ value: 'BARBER', label: 'Profissional' }, { value: 'RECEPTIONIST', label: 'Recepcionista' }]} />
                </Field>
              ) : null}
              <Toggle label="Atende clientes (aparece na agenda e na página)" checked={m.isProfessional} onChange={(e) => setM({ ...m, isProfessional: e.target.checked })} />
              {m.role === 'BARBER' ? (
                <>
                  <Toggle label="Pode gerenciar a própria agenda (horários e bloqueios)" checked={m.canManageOwnSchedule} onChange={(e) => setM({ ...m, canManageOwnSchedule: e.target.checked })} />
                  <Toggle label="Pode gerenciar serviços" checked={m.canManageOwnServices} onChange={(e) => setM({ ...m, canManageOwnServices: e.target.checked })} />
                </>
              ) : null}
              {m.isProfessional ? (
                <div className="form-grid">
                  <Field label="Comissão" id="ct">
                    <Select
                      id="ct"
                      value={m.commissionType}
                      onChange={(e) => setM({ ...m, commissionType: e.target.value })}
                      options={[{ value: 'DEFAULT', label: 'Padrão da loja' }, ...Object.entries(COMMISSION_LABELS).map(([value, label]) => ({ value, label }))]}
                    />
                  </Field>
                  {m.commissionType !== 'DEFAULT' && m.commissionType !== 'NONE' ? (
                    <Field label={m.commissionType === 'PERCENT' ? 'Percentual (%)' : m.commissionType === 'FIXED' ? 'Valor por serviço (R$)' : 'Aluguel mensal (R$)'} id="cv">
                      <Input id="cv" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Modal>
        ) : null}
      </td>
    </tr>
  );
}

export function InviteForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('BARBER');
  const [link, setLink] = useState<string | null>(null);
  const { run, pending } = useAction();
  return (
    <div className="stack-sm">
      <div className="form-grid">
        <Field label="E-mail da pessoa" id="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Papel" id="role">
          <Select id="role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: 'BARBER', label: 'Profissional' }, { value: 'RECEPTIONIST', label: 'Recepcionista (não conta no limite)' }]} />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button icon="send" disabled={pending} onClick={() => run(() => inviteAction({ email, role: role as 'BARBER' }), { onSuccess: (r) => { setLink(r.data?.link ?? null); setEmail(''); } })}>
          {pending ? 'Enviando...' : 'Enviar convite'}
        </Button>
      </div>
      {link ? (
        <div className="link-box">
          <span>{link}</span>
          <CopyButton text={link} label="Copiar link" />
        </div>
      ) : null}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const { run, pending } = useAction();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeInviteAction(id))}>
      Cancelar
    </Button>
  );
}

export function ShopCommissionForm({ initial }: { initial: { type: string; value: number; productPercent: number } }) {
  const [type, setType] = useState(initial.type);
  const [value, setValue] = useState(toInput(initial.type, initial.value));
  const [prod, setProd] = useState(String(initial.productPercent / 100).replace('.', ','));
  const { run, pending, error, setError } = useAction();
  return (
    <div className="stack">
      {error ? <p className="field-error">{error}</p> : null}
      <div className="form-grid">
        <Field label="Tipo" id="t">
          <Select id="t" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(COMMISSION_LABELS).map(([value, label]) => ({ value, label }))} />
        </Field>
        {type !== 'NONE' ? (
          <Field label={type === 'PERCENT' ? 'Percentual (%)' : type === 'FIXED' ? 'Valor por serviço (R$)' : 'Aluguel mensal (R$)'} id="v">
            <Input id="v" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Comissão sobre produtos (%)" id="p">
          <Input id="p" inputMode="decimal" value={prod} onChange={(e) => setProd(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button
          disabled={pending}
          onClick={() => {
            const v = type === 'NONE' ? 0 : parseBRL(value);
            const p = parseBRL(prod || '0');
            if (v === null || p === null) return setError('Valor inválido.');
            run(() => updateShopCommissionAction(type as 'PERCENT', v, p));
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
