import { AuthLayout } from '@/components/auth/AuthLayout';
import { RequestResetForm } from '@/components/auth/forms';

export const metadata = { title: 'Recuperar senha' };

export default function Page() {
  return (
    <AuthLayout title="Acontece com todo mundo." text="Informe seu e-mail e enviamos um link para criar uma senha nova.">
      <RequestResetForm />
    </AuthLayout>
  );
}
