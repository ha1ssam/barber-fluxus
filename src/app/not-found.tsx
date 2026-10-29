import Link from 'next/link';
import { EmptyState } from '@/components/ui/basic';

export default function NotFound() {
  return (
    <main className="public-narrow" style={{ paddingTop: 80 }}>
      <EmptyState icon="search" title="Página não encontrada" text="O link pode estar errado ou a loja mudou de endereço." action={<Link className="btn btn-primary" href="/explorar">Explorar lojas</Link>} />
    </main>
  );
}
