import { mkdir, writeFile } from 'node:fs/promises';
import { NextResponse, type NextRequest } from 'next/server';
import { randomToken } from '@/lib/crypto';
import { loadMemberContext } from '@/server/context';
import { can } from '@/lib/domain/permissions';
import { uploadDir, uploadPath } from '@/server/uploads';

const MAX = 5 * 1024 * 1024;

function sniff(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

/** Upload de fotos da loja e dos profissionais (até 5 MB; JPG, PNG ou WebP). */
export async function POST(req: NextRequest) {
  const ctx = await loadMemberContext();
  if (!ctx?.membership) return NextResponse.json({ error: 'Entre de novo.' }, { status: 401 });
  if (!can(ctx.membership, 'settings') && !ctx.membership.canManageOwnSchedule) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Envie um arquivo.' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: 'A imagem pode ter no máximo 5 MB.' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return NextResponse.json({ error: 'Use uma imagem JPG, PNG ou WebP.' }, { status: 400 });
  await mkdir(uploadDir(), { recursive: true });
  const name = `${ctx.shop!.id.slice(-8)}-${randomToken(12)}.${ext}`;
  await writeFile(uploadPath(name), buf);
  return NextResponse.json({ url: `/api/files/${name}` });
}
