// Dados de demonstração: uma barbearia com dois profissionais, serviços, clientes e histórico.
// Login: ze@fluxus.dev / senha12345 (dono)  ·  rafa@fluxus.dev / senha12345 (barbeiro)  ·  cliente@fluxus.dev / senha12345
import { PrismaClient, type AppointmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { addDays, todayIn, zonedToUtc } from '../src/lib/domain/time';

const db = new PrismaClient();
const TZ = 'America/Sao_Paulo';

async function main() {
  const existing = await db.shop.findUnique({ where: { slug: 'barbearia-do-ze' } });
  if (existing) {
    console.log('Seed já aplicado (barbearia-do-ze existe).');
    return;
  }
  const hash = await bcrypt.hash('senha12345', 10);
  const now = new Date();
  const today = todayIn(TZ, now);

  const [ze, rafa, cliente] = await Promise.all([
    db.user.create({ data: { name: 'José Almeida', email: 'ze@fluxus.dev', phone: '5511987650001', passwordHash: hash, emailVerifiedAt: now, cpf: '52998224725' } }),
    db.user.create({ data: { name: 'Rafael Souza', email: 'rafa@fluxus.dev', phone: '5511987650002', passwordHash: hash, emailVerifiedAt: now } }),
    db.user.create({ data: { name: 'Lucas Ferreira', email: 'cliente@fluxus.dev', phone: '5511912340000', passwordHash: hash, emailVerifiedAt: now } }),
  ]);

  const hours = [2, 3, 4, 5, 6].flatMap((weekday) => [
    { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
    { weekday, startMinute: 13 * 60, endMinute: 19 * 60 },
  ]);
  const saturday = [{ weekday: 6, startMinute: 8 * 60, endMinute: 14 * 60 }];

  const shop = await db.shop.create({
    data: {
      slug: 'barbearia-do-ze',
      name: 'Barbearia do Zé',
      description: 'Corte clássico e moderno, barba na toalha quente e aquele café passado na hora.',
      phone: '5511987650001',
      addressLine: 'Rua Augusta, 1200',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01304-001',
      instagram: 'barbeariadoze',
      paymentMethods: ['cash', 'pix', 'credit', 'debit'],
      amenities: ['wifi', 'ar', 'cafe', 'cerveja', 'acessibilidade'],
      slotInterval: 30,
      autoConfirm: false,
      subscription: { create: { plan: 'equipe', status: 'TRIALING', trialEndsAt: new Date(now.getTime() + 7 * 86_400_000) } },
      whatsapp: { create: {} },
      memberships: {
        create: [
          { userId: ze.id, role: 'OWNER', isProfessional: true, workingHours: { create: [...hours.filter((h) => h.weekday !== 6), ...saturday] } },
          { userId: rafa.id, role: 'BARBER', isProfessional: true, commissionType: 'PERCENT', commissionValue: 5000, workingHours: { create: hours } },
        ],
      },
    },
    include: { memberships: true },
  });
  const [mZe, mRafa] = shop.memberships.sort((a) => (a.role === 'OWNER' ? -1 : 1));

  const serviceData = [
    { name: 'Corte', category: 'HAIRCUT', priceCents: 4500, durationMinutes: 30, description: 'Tesoura e máquina, com lavagem.' },
    { name: 'Barba', category: 'BEARD', priceCents: 3500, durationMinutes: 30, description: 'Toalha quente e navalha.' },
    { name: 'Corte + barba', category: 'COMBO', priceCents: 7000, durationMinutes: 60, description: 'O combo completo.' },
    { name: 'Sobrancelha', category: 'EYEBROW', priceCents: 1500, durationMinutes: 10, description: null },
    { name: 'Pigmentação', category: 'HAIR', priceCents: 4000, durationMinutes: 40, description: 'Disfarça falhas na barba ou no cabelo.' },
  ] as const;
  const services = [];
  for (const [i, s] of serviceData.entries()) {
    services.push(
      await db.service.create({
        data: { ...s, shopId: shop.id, sortOrder: i, professionals: { create: [{ membershipId: mZe.id }, { membershipId: mRafa.id }] } },
      }),
    );
  }

  await db.product.createMany({
    data: [
      { shopId: shop.id, name: 'Pomada modeladora', priceCents: 3900 },
      { shopId: shop.id, name: 'Óleo para barba', priceCents: 4500 },
      { shopId: shop.id, name: 'Cerveja long neck', priceCents: 1200 },
    ],
  });
  await db.coupon.create({ data: { shopId: shop.id, code: 'BEMVINDO10', type: 'PERCENT', value: 1000, maxUses: 100 } });

  const names = ['Lucas Ferreira', 'Pedro Lima', 'Mateus Rocha', 'Gabriel Santos', 'Thiago Costa', 'André Nunes', 'Bruno Martins', 'Felipe Araújo', 'Diego Ribeiro', 'Caio Mendes'];
  const clients = [];
  for (const [i, name] of names.entries()) {
    clients.push(
      await db.client.create({
        data: {
          shopId: shop.id,
          name,
          phone: i === 0 ? '5511912340000' : `55119${String(87000000 + i * 1111).padStart(8, '0')}`,
          email: i === 0 ? 'cliente@fluxus.dev' : null,
          userId: i === 0 ? cliente.id : null,
          birthDate: i === 1 ? new Date(`1995-${today.slice(5)}T00:00:00Z`) : null,
          referralCode: randomBytes(4).toString('hex').slice(0, 6).toUpperCase(),
          notes: i === 2 ? 'Prefere máquina 2 nas laterais.' : null,
        },
      }),
    );
  }

  // Histórico de 21 dias para trás e reservas para os próximos 5 dias.
  let token = 0;
  const pros = [mZe, mRafa];
  for (let d = -21; d <= 5; d++) {
    const date = addDays(today, d);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 1) continue;
    for (const [pi, pro] of pros.entries()) {
      const slots = d < 0 ? [9 * 60, 10 * 60, 14 * 60, 16 * 60] : [10 * 60, 15 * 60];
      for (const [si, minute] of slots.entries()) {
        const svc = services[(si + pi + d + 30) % 3];
        const client = clients[(si * 3 + pi + d + 40) % clients.length];
        const startsAt = zonedToUtc(date, minute, TZ);
        const endsAt = new Date(startsAt.getTime() + svc.durationMinutes * 60_000);
        let status: AppointmentStatus = 'CONFIRMED';
        if (endsAt < now) status = (si + d) % 9 === 0 ? 'NO_SHOW' : (si + d) % 11 === 0 ? 'CANCELLED' : 'COMPLETED';
        else if (si === 1 && d > 0) status = 'PENDING';
        const appt = await db.appointment.create({
          data: {
            shopId: shop.id,
            professionalId: pro.id,
            clientId: client.id,
            startsAt,
            endsAt,
            status,
            source: si === 0 ? 'ONLINE' : 'MANUAL',
            totalPriceCents: svc.priceCents,
            totalDurationMinutes: svc.durationMinutes,
            publicToken: `demo${token++}${randomBytes(6).toString('hex')}`,
            confirmedAt: status !== 'PENDING' ? startsAt : null,
            completedAt: status === 'COMPLETED' ? endsAt : null,
            cancelledAt: status === 'CANCELLED' ? startsAt : null,
            services: { create: [{ serviceId: svc.id, name: svc.name, priceCents: svc.priceCents, durationMinutes: svc.durationMinutes }] },
          },
        });
        if (status === 'COMPLETED') {
          await db.sale.create({
            data: {
              shopId: shop.id,
              appointmentId: appt.id,
              clientId: client.id,
              professionalId: pro.id,
              subtotalCents: svc.priceCents,
              totalCents: svc.priceCents,
              paymentMethod: (['PIX', 'CASH', 'CREDIT', 'DEBIT'] as const)[(si + d + 40) % 4],
              createdById: ze.id,
              createdAt: endsAt,
              items: { create: [{ kind: 'SERVICE', serviceId: svc.id, professionalId: pro.id, description: svc.name, unitCents: svc.priceCents, totalCents: svc.priceCents }] },
            },
          });
          await db.client.update({ where: { id: client.id }, data: { stamps: { increment: 1 } } });
          if ((si + d) % 4 === 0) {
            await db.review.create({
              data: {
                shopId: shop.id,
                appointmentId: appt.id,
                clientId: client.id,
                rating: (si + d) % 8 === 0 ? 4 : 5,
                comment: ['Atendimento excelente!', 'Melhor degradê da região.', 'Ambiente top e pontual.', null, 'Rafa é muito caprichoso.'][(pi + Math.abs(d)) % 5],
                createdAt: endsAt,
              },
            }).catch(() => undefined);
          }
        }
      }
    }
  }
  await db.timeBlock.create({
    data: { shopId: shop.id, professionalId: mRafa.id, startsAt: zonedToUtc(addDays(today, 2), 12 * 60, TZ), endsAt: zonedToUtc(addDays(today, 2), 13 * 60 + 30, TZ), reason: 'Médico' },
  });
  console.log('Seed pronto: http://localhost:3000/barbearia-do-ze  ·  login ze@fluxus.dev / senha12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
