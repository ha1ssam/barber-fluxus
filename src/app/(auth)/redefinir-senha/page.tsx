import { AuthLayout } from '@/components/auth/AuthLayout';
import { ResetPasswordForm } from '@/components/auth/forms';

export const metadata = { title: 'Nova senha' };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthLayout title="Crie uma senha nova." text="Depois de salvar, você entra direto na sua conta.">
      <ResetPasswordForm token={token ?? ''} />
    </AuthLayout>
  );
}
