'use client';
import { EmptyState } from '@/components/ui/basic';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="public-narrow" style={{ paddingTop: 80 }}>
      <EmptyState icon="error" title="Algo deu errado" text="Tente de novo. Se continuar, fale com o suporte." action={<button className="btn btn-primary" onClick={reset}>Tentar de novo</button>} />
    </main>
  );
}
