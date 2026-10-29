import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { clientIp, createSession, getCurrentUser, setActiveShop } from '@/lib/auth/session';
import { isValidCpf } from '@/lib/domain/cpf';
import { normalizePhone } from '@/lib/domain/phone';
import { createShopForOwner } from '@/server/shops';
import { AuthLayout } from '@/components/auth/AuthLayout';

export const metadata = { title: 'Criar meu negócio' };

async function create(form: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/painel/criar-loja');
  const schema = z.object({ shopName: z.string().trim().min(2), businessType: z.enum(['BARBERSHOP', 'SALON', 'AESTHETICS', 'NAILS', 'OTHER']), cpf: z.string(), phone: z.string() });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success || !isValidCpf(parsed.data.cpf)) redirect('/painel/criar-loja?erro=dados');
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) redirect('/painel/criar-loja?erro=telefone');
  if (await db.membership.findFirst({ where: { userId: user.id, role: { not: 'OWNER' }, active: true } })) redirect('/painel/criar-loja?erro=equipe');
  await db.user.update({ where: { id: user.id }, data: { phone, cpf: parsed.data.cpf.replace(/\D/g, '') } });
  const { shop } = await createShopForOwner({ userId: user.id, name: parsed.data.shopName, businessType: parsed.data.businessType, cpf: parsed.data.cpf, ip: await clientIp() });
  await setActiveShop(shop.id);
  await createSession(user.id, shop.id);
  redirect('/painel?bem-vindo=1');
}

const ERRORS: Record<string, string> = {
  dados: 'Confira o nome do negócio e o CPF.',
  telefone: 'Telefone inválido. Use DDD + número.',
  equipe: 'Você já faz parte de uma equipe. Saia dela antes de criar seu próprio negócio.',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/painel/criar-loja');
  const { erro } = await searchParams;
  return (
    <AuthLayout title="Seu negócio no ar em minutos." text="Depois é só cadastrar os serviços e divulgar o link de agendamento.">
      <form action={create} className="fx-auth auth-form">
        <div>
          <h1 className="fx-auth-title">Criar meu negócio</h1>
          <p className="fx-auth-sub">Você ganha 7 dias de teste com todos os recursos.</p>
        </div>
        {erro ? <div className="fx-auth-error">{ERRORS[erro] ?? 'Confira os dados.'}</div> : null}
        <div>
          <label className="fx-auth-label" htmlFor="shopName">Nome do negócio</label>
          <input id="shopName" name="shopName" className="fx-auth-input" required placeholder="Barbearia do Zé" />
        </div>
        <div>
          <label className="fx-auth-label" htmlFor="businessType">Tipo de negócio</label>
          <select id="businessType" name="businessType" className="fx-auth-input" defaultValue="BARBERSHOP">
            <option value="BARBERSHOP">Barbearia</option>
            <option value="SALON">Salão de beleza</option>
            <option value="AESTHETICS">Estética</option>
            <option value="NAILS">Manicure e unhas</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>
        <div>
          <label className="fx-auth-label" htmlFor="phone">WhatsApp</label>
          <input id="phone" name="phone" type="tel" className="fx-auth-input" required defaultValue={user.phone ?? ''} placeholder="(11) 98765-4321" />
        </div>
        <div>
          <label className="fx-auth-label" htmlFor="cpf">CPF</label>
          <input id="cpf" name="cpf" className="fx-auth-input" inputMode="numeric" required placeholder="000.000.000-00" />
        </div>
        <button className="fx-auth-btn" type="submit">Criar e começar o teste</button>
        <p className="auth-foot">
          <a href="/meus-agendamentos">Voltar para meus agendamentos</a>
        </p>
      </form>
    </AuthLayout>
  );
}
