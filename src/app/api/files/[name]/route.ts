import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { uploadPath } from '@/server/uploads';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9]+-[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(name)) return new NextResponse(null, { status: 404 });
  try {
    const data = await readFile(uploadPath(name));
    return new NextResponse(new Uint8Array(data), {
      headers: { 'content-type': TYPES[name.split('.').pop()!], 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
