import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/forms';
import { getCurrentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/redirect';
import { env } from '@/lib/env';

export const metadata = { title: 'Entrar' };

const NOTICES: Record<string, string> = {
  'email-verificado': 'E-mail confirmado. Agora é só entrar.',
  'google-erro': 'Não foi possível entrar com o Google. Tente de novo.',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; aviso?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(sp.next, '/painel'));
  return (
    <AuthLayout title="Sua agenda cheia, sem trabalho manual." text="Agendamento online, lembretes no WhatsApp, caixa e fidelidade num lugar só.">
      <LoginForm next={sp.next} googleEnabled={!!env.googleClientId()} notice={sp.aviso ? NOTICES[sp.aviso] : undefined} />
    </AuthLayout>
  );
}
