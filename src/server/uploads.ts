import 'server-only';
import path from 'node:path';

/** Pasta das fotos enviadas (no Docker, um volume). */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads');
}

export function uploadPath(name: string): string {
  return path.join(/* turbopackIgnore: true */ uploadDir(), name);
}
