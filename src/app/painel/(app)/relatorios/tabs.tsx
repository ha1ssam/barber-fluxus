'use client';
import { usePathname, useRouter } from 'next/navigation';
import { PillTabs } from '@/components/ui/interactive';

export function PeriodTabs({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <PillTabs
      items={[
        { id: 'semana', label: 'Semana' },
        { id: 'mes', label: 'Mês' },
        { id: 'ano', label: 'Ano' },
      ]}
      value={value}
      onChange={(v) => router.push(`${pathname}?periodo=${v}`)}
    />
  );
}
