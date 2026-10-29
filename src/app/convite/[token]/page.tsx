import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { createSession, getCurrentUser } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/domain/permissions';
import { AuthLayout } from '@/components/auth/AuthLayout';

export const metadata = { title: 'Convite' };

async function findInvite(token: string) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { shop: true } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) return null;
  return inv;
}

async function accept(form: FormData) {
  'use server';
  const token = String(form.get('token'));
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=/convite/${token}`);
  const inv = await findInvite(token);
  if (!inv) redirect(`/convite/${token}`);
  // Uma pessoa só pode estar numa equipe e não pode ser dona de outra loja ao mesmo tempo.
  const other = await db.membership.findFirst({ where: { userId: user.id, active: true, shopId: { not: inv.shopId } } });
  if (other) redirect(`/convite/${token}?erro=outra-equipe`);
  const owner = await db.membership.findFirst({ where: { shopId: inv.shopId, role: 'OWNER' }, include: { workingHours: true } });
  const services = await db.service.findMany({ where: { shopId: inv.shopId, active: true }, select: { id: true } });
  const isPro = inv.role === 'BARBER';
  await db.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { shopId_userId: { shopId: inv.shopId, userId: user.id } } });
    const data = { role: inv.role, isProfessional: isPro, active: true };
    const m = existing
      ? await tx.membership.update({ where: { id: existing.id }, data })
      : await tx.membership.create({
          data: {
            ...data,
            shopId: inv.shopId,
            userId: user.id,
            workingHours: isPro && owner ? { create: owner.workingHours.map((h) => ({ weekday: h.weekday, startMinute: h.startMinute, endMinute: h.endMinute })) } : undefined,
            services: isPro ? { create: services.map((s) => ({ serviceId: s.id })) } : undefined,
          },
        });
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    return m;
  });
  await createSession(user.id, inv.shopId);
  redirect('/painel');
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { token } = await params;
  const { erro } = await searchParams;
  const inv = await findInvite(token);
  const user = await getCurrentUser();
  return (
    <AuthLayout title="Bem-vindo à equipe." text="Com o convite aceito você vê sua agenda, seus clientes e seus atendimentos.">
      <div className="fx-auth auth-form">
        {!inv ? (
          <>
            <h1 className="fx-auth-title">Convite inválido</h1>
            <p className="fx-auth-sub">Este convite venceu, foi cancelado ou já foi usado. Peça um novo para o dono da loja.</p>
          </>
        ) : (
          <>
            <div>
              <h1 className="fx-auth-title">{inv.shop.name}</h1>
              <p className="fx-auth-sub">Você foi convidado como {ROLE_LABELS[inv.role].toLowerCase()}.</p>
            </div>
            {erro === 'outra-equipe' ? <div className="fx-auth-error">Você já faz parte de outra loja. Saia dela antes de aceitar este convite.</div> : null}
            {user ? (
              <form action={accept} className="stack">
                <input type="hidden" name="token" value={token} />
                <p className="fx-auth-sub">Entrando como {user.email}.</p>
                <button className="fx-auth-btn" type="submit">Aceitar convite</button>
              </form>
            ) : (
              <div className="stack">
                <Link className="fx-auth-btn" href={`/cadastro?tipo=cliente&next=/convite/${token}`} style={{ textDecoration: 'none' }}>
                  Criar conta e aceitar
                </Link>
                <Link className="fx-auth-btn outline" href={`/entrar?next=/convite/${token}`} style={{ textDecoration: 'none' }}>
                  Já tenho conta
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
