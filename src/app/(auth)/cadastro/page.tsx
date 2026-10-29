import { AuthLayout } from '@/components/auth/AuthLayout';
import { SignupForm } from '@/components/auth/forms';
import { env } from '@/lib/env';

export const metadata = { title: 'Criar conta' };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; tipo?: string }> }) {
  const sp = await searchParams;
  const kind = sp.tipo === 'cliente' || (sp.next && !sp.next.startsWith('/painel') && sp.tipo !== 'negocio') ? 'client' : 'owner';
  return (
    <AuthLayout title="Comece hoje. Teste 7 dias grátis." text="Crie sua página de agendamento em minutos e divulgue o link no Instagram e no WhatsApp.">
      <SignupForm next={sp.next} initialKind={kind} googleEnabled={!!env.googleClientId()} />
    </AuthLayout>
  );
}
