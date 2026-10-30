'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { loginAction, requestResetAction, resetPasswordAction, signupAction, type FormState } from '@/app/(auth)/actions';
import { Icon } from '@/components/ui/Icon';

function Field({ label, aside, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; aside?: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="fx-auth-label" htmlFor={rest.id}>
          {label}
        </label>
        {aside}
      </div>
      <input {...rest} className="fx-auth-input" />
    </div>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <div className="fx-auth-error" role="alert">{state.error}</div>;
  if (state?.ok) return <div className="fx-auth-ok" role="status">{state.ok}</div>;
  return null;
}

function GoogleButton({ next, intent }: { next?: string; intent?: string }) {
  const q = new URLSearchParams();
  if (next) q.set('next', next);
  if (intent) q.set('intent', intent);
  return (
    <a className="fx-auth-btn outline" href={`/api/auth/google?${q}`} style={{ textDecoration: 'none' }}>
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continuar com Google
    </a>
  );
}

export function LoginForm({ next, googleEnabled, notice }: { next?: string; googleEnabled: boolean; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="fx-auth auth-form">
      <div>
        <h1 className="fx-auth-title">Entrar</h1>
        <p className="fx-auth-sub">Acesse sua conta e gerencie sua barbearia.</p>
      </div>
      {notice ? <div className="fx-auth-ok">{notice}</div> : null}
      <Feedback state={state} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field label="E-mail" id="email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
      <Field
        label="Senha"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Sua senha"
        aside={
          <Link className="fx-auth-link" href="/recuperar-senha">
            Esqueci minha senha
          </Link>
        }
      />
      <button className="fx-auth-btn" type="submit" disabled={pending}>
        {pending ? 'Entrando...' : 'Entrar'}
      </button>
      {googleEnabled ? (
        <>
          <div className="fx-auth-divider">ou</div>
          <GoogleButton next={next} />
        </>
      ) : null}
      <p className="auth-foot">
        Ainda não tem conta? <Link href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Criar conta</Link>
      </p>
    </form>
  );
}

const BUSINESS_TYPES = [
  { value: 'BARBERSHOP', label: 'Barbearia' },
  { value: 'SALON', label: 'Salão de beleza' },
  { value: 'AESTHETICS', label: 'Estética' },
  { value: 'NAILS', label: 'Manicure e unhas' },
  { value: 'OTHER', label: 'Outro' },
];

export function SignupForm({ next, initialKind, googleEnabled }: { next?: string; initialKind: 'owner' | 'client'; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const [kind, setKind] = useState(initialKind);
  return (
    <form action={action} className="fx-auth auth-form">
      <div>
        <h1 className="fx-auth-title">Criar conta</h1>
        <p className="fx-auth-sub">{kind === 'owner' ? '7 dias grátis, sem cartão.' : 'Acompanhe e cancele seus horários.'}</p>
      </div>
      <div className="auth-choice">
        <button type="button" className={`fx-auth-btn soft ${kind === 'owner' ? 'selected' : ''}`} onClick={() => setKind('owner')} aria-pressed={kind === 'owner'}>
          <Icon name="store-alt" size={14} /> Criar meu negócio
        </button>
        <button type="button" className={`fx-auth-btn outline ${kind === 'client' ? 'selected' : ''}`} onClick={() => setKind('client')} aria-pressed={kind === 'client'}>
          <Icon name="user" size={14} /> Sou cliente
        </button>
      </div>
      <Feedback state={state} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field label="Seu nome" id="name" name="name" autoComplete="name" required placeholder="Nome e sobrenome" />
      <Field label="E-mail" id="email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
      <Field label="WhatsApp" id="phone" name="phone" type="tel" autoComplete="tel" required placeholder="(11) 98765-4321" />
      {kind === 'owner' ? (
        <>
          <Field label="Nome do negócio" id="shopName" name="shopName" required placeholder="Barbearia do Zé" />
          <div>
            <label className="fx-auth-label" htmlFor="businessType">
              Tipo de negócio
            </label>
            <select id="businessType" name="businessType" className="fx-auth-input" defaultValue="BARBERSHOP">
              {BUSINESS_TYPES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <Field label="CPF" id="cpf" name="cpf" inputMode="numeric" required placeholder="000.000.000-00" />
        </>
      ) : null}
      <Field label="Senha" id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" />
      <button className="fx-auth-btn" type="submit" disabled={pending}>
        {pending ? 'Criando...' : kind === 'owner' ? 'Começar teste grátis' : 'Criar conta'}
      </button>
      {googleEnabled ? (
        <>
          <div className="fx-auth-divider">ou</div>
          <GoogleButton next={next} intent={kind} />
        </>
      ) : null}
      <p className="auth-foot">
        Já tem conta? <Link href={`/entrar${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Entrar</Link>
      </p>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, undefined);
  return (
    <form action={action} className="fx-auth auth-form">
      <div>
        <h1 className="fx-auth-title">Recuperar senha</h1>
        <p className="fx-auth-sub">Enviamos um link para você criar uma senha nova.</p>
      </div>
      <Feedback state={state} />
      <Field label="E-mail" id="email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
      <button className="fx-auth-btn" type="submit" disabled={pending}>
        {pending ? 'Enviando...' : 'Enviar link'}
      </button>
      <p className="auth-foot">
        <Link href="/entrar">Voltar para o login</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="fx-auth auth-form">
      <div>
        <h1 className="fx-auth-title">Nova senha</h1>
        <p className="fx-auth-sub">Use pelo menos 8 caracteres.</p>
      </div>
      <Feedback state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" />
      <Field label="Repita a senha" id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} placeholder="Digite a senha de novo" />
      <button className="fx-auth-btn" type="submit" disabled={pending}>
        {pending ? 'Salvando...' : 'Salvar senha'}
      </button>
    </form>
  );
}
