'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useToast } from './toast';

export type Result<T = unknown> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

/** Roda uma server action mostrando toast de sucesso/erro e atualizando a página. */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run<T>(fn: () => Promise<Result<T>>, opts: { success?: string; onSuccess?: (r: { data?: T }) => void; refresh?: boolean } = {}) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        const msg = r.message ?? opts.success;
        if (msg) toast('success', msg);
        opts.onSuccess?.(r);
        if (opts.refresh !== false) router.refresh();
      } else {
        setError(r.error);
        toast('error', r.error);
      }
    });
  }
  return { run, pending, error, setError };
}
