'use client';
import { usePathname, useRouter } from 'next/navigation';
import { IconButton, Input } from '@/components/ui/basic';
import { addMonths } from '@/lib/domain/time';

export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (m: string) => router.push(`${pathname}?mes=${m}`);
  return (
    <div className="row">
      <IconButton icon="chevron-left" label="Mês anterior" onClick={() => go(addMonths(`${month}-01`, -1).slice(0, 7))} />
      <Input type="month" value={month} onChange={(e) => e.target.value && go(e.target.value)} style={{ width: 170 }} aria-label="Mês" />
      <IconButton icon="chevron-right" label="Próximo mês" onClick={() => go(addMonths(`${month}-01`, 1).slice(0, 7))} />
    </div>
  );
}
