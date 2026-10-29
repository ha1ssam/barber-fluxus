import { db } from '@/lib/db';
import { hasFeature } from '@/lib/domain/plans';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { requireMember } from '@/server/context';
import { ProductsClient } from './client';

export const metadata = { title: 'Produtos' };

export default async function ProductsPage() {
  const ctx = await requireMember('products');
  if (!hasFeature(ctx.plan, 'cash')) return <Page title="Produtos" icon="package"><FeatureLocked feature="Produtos" reason={ctx.plan.reason} /></Page>;
  const products = await db.product.findMany({ where: { shopId: ctx.shop.id }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  const sold = await db.saleItem.groupBy({ by: ['productId'], where: { kind: 'PRODUCT', sale: { shopId: ctx.shop.id } }, _sum: { quantity: true, totalCents: true } });
  return (
    <Page title="Produtos" icon="package" badge={`${products.filter((p) => p.active).length} ativos`}>
      <p className="muted sm-text">Produtos vendidos no caixa (pomada, óleo, bebidas). Sem controle de estoque.</p>
      <ProductsClient
        products={products.map((p) => {
          const s = sold.find((x) => x.productId === p.id);
          return { id: p.id, name: p.name, priceCents: p.priceCents, active: p.active, soldQty: s?._sum.quantity ?? 0, soldCents: s?._sum.totalCents ?? 0 };
        })}
      />
    </Page>
  );
}
