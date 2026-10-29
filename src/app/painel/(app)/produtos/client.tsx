'use client';
import { useState } from 'react';
import { saveProductAction } from './actions';
import { Button, EmptyState, Field, Input, Toggle } from '@/components/ui/basic';
import { Modal } from '@/components/ui/interactive';
import { useAction } from '@/components/use-action';
import { formatBRL, parseBRL } from '@/lib/domain/money';

type Product = { id: string; name: string; priceCents: number; active: boolean; soldQty: number; soldCents: number };

export function ProductsClient({ products }: { products: Product[] }) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const { run } = useAction();
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button icon="plus" onClick={() => setEditing('new')}>
          Novo produto
        </Button>
      </div>
      {products.length === 0 ? (
        <EmptyState icon="package" title="Nenhum produto" text="Cadastre o que você vende no balcão para lançar no caixa." />
      ) : (
        <div className="table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Preço</th>
                <th className="num">Vendidos</th>
                <th className="num">Faturado</th>
                <th>Ativo</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.6 }}>
                  <td className="strong">{p.name}</td>
                  <td className="num price-text">{formatBRL(p.priceCents)}</td>
                  <td className="num">{p.soldQty}</td>
                  <td className="num">{formatBRL(p.soldCents)}</td>
                  <td>
                    <Toggle checked={p.active} onChange={(e) => run(() => saveProductAction({ id: p.id, name: p.name, priceCents: p.priceCents, active: e.target.checked }))} label={<span className="sr-only">Ativo</span>} />
                  </td>
                  <td className="num">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(p)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? <ProductModal product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const { run, pending, error, setError } = useAction();
  return (
    <Modal
      title={product ? 'Editar produto' : 'Novo produto'}
      eyebrow="Produtos"
      onClose={onClose}
      footer={
        <Button
          disabled={pending}
          onClick={() => {
            const cents = parseBRL(price);
            if (cents === null) return setError('Preço inválido.');
            run(() => saveProductAction({ id: product?.id, name, priceCents: cents, active: product?.active ?? true }), { onSuccess: onClose });
          }}
        >
          Salvar
        </Button>
      }
    >
      <div className="stack">
        {error ? <p className="field-error">{error}</p> : null}
        <Field label="Nome" id="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Preço (R$)" id="price">
          <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
