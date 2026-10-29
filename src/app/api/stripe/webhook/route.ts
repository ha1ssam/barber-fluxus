import { NextResponse, type NextRequest } from 'next/server';
import { applyStripeEvent, verifyStripeSignature } from '@/server/stripe';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get('stripe-signature'))) return NextResponse.json({ error: 'assinatura inválida' }, { status: 400 });
  await applyStripeEvent(JSON.parse(payload));
  return NextResponse.json({ received: true });
}
