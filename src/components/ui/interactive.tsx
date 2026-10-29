'use client';
// Componentes do UI kit Fluxus com estado.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { IconButton } from './basic';
import { cx } from './cx';

function useControlled<T>(value: T | undefined, fallback: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState<T>(value !== undefined ? value : fallback);
  const current = value !== undefined ? value : inner;
  return [
    current,
    (v: T) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
  ];
}

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
}

export function PillTabs({ items, value, onChange }: { items: TabItem[]; value?: string; onChange?: (id: string) => void }) {
  const [cur, set] = useControlled(value, items[0]?.id ?? '', onChange);
  return (
    <div className="pill-tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={cur === it.id} className={cx('pill-tab', cur === it.id && 'active')} onClick={() => set(it.id)}>
          {it.icon ? <Icon name={it.icon} size={15} /> : null}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTabs({ items, value, onChange }: { items: TabItem[]; value?: string; onChange?: (id: string) => void }) {
  const [cur, set] = useControlled(value, items[0]?.id ?? '', onChange);
  return (
    <nav className="bp-section-nav">
      <div className="bp-section-nav-inner">
        {items.map((it) => (
          <button key={it.id} type="button" className={cx('bp-section-tab', cur === it.id && 'active')} onClick={() => set(it.id)}>
            {it.icon ? <Icon name={it.icon} size={15} /> : null}
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function StepPills({ steps, current, onSelect }: { steps: { label: string; icon: IconName }[]; current: number; onSelect?: (i: number) => void }) {
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;
  return (
    <div className="bp-steps-bar">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : '';
        return (
          <button
            key={s.label}
            type="button"
            className={cx('bp-step-pill', state)}
            disabled={i > current}
            aria-current={i === current ? 'step' : undefined}
            onClick={() => {
              if (onSelect && i <= current) onSelect(i);
            }}
          >
            <Icon name={i < current ? 'check' : s.icon} size={14} />
            {s.label}
          </button>
        );
      })}
      <div className="bp-steps-progress">
        <div className="bp-steps-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TimeSlots({ groups, value, onChange }: { groups: { label: string; icon?: IconName; slots: string[] }[]; value?: string; onChange?: (t: string) => void }) {
  const [cur, set] = useControlled<string | null>(value, null, onChange as (v: string | null) => void);
  return (
    <div className="book-slot-groups">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="book-slot-group-label">
            {g.icon ? <Icon name={g.icon} size={14} /> : null}
            {g.label}
          </div>
          <div className="book-slot-grid">
            {g.slots.map((t) => (
              <button key={t} type="button" className={cx('book-slot', cur === t && 'active')} aria-pressed={cur === t} onClick={() => set(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad = (n: number) => String(n).padStart(2, '0');
function iso(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function MiniCalendar({
  selected,
  today,
  minDate,
  maxDate,
  onSelect,
  isDisabled,
}: {
  selected?: string;
  today: string;
  minDate?: string;
  maxDate?: string;
  onSelect?: (date: string) => void;
  isDisabled?: (date: string) => boolean;
}) {
  const [sel, set] = useControlled(selected, today, onSelect);
  const base = sel || today;
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  useEffect(() => {
    if (selected) setView({ y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) - 1 });
  }, [selected]);
  const { y, m } = view;
  const start = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dprev = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: { d: number; m: number; other: boolean }[] = [];
  for (let i = start - 1; i >= 0; i--) cells.push({ d: dprev - i, m: m - 1, other: true });
  for (let i = 1; i <= dim; i++) cells.push({ d: i, m, other: false });
  for (let i = 1; cells.length < 42; i++) cells.push({ d: i, m: m + 1, other: true });
  const move = (k: number) => {
    const n = new Date(Date.UTC(y, m + k, 1));
    setView({ y: n.getUTCFullYear(), m: n.getUTCMonth() });
  };
  return (
    <div className="mini-cal">
      <div className="cal-header">
        <IconButton icon="chevron-left" label="Mês anterior" iconSize={16} onClick={() => move(-1)} />
        <span>
          {MONTHS[m]} {y}
        </span>
        <IconButton icon="chevron-right" label="Próximo mês" iconSize={16} onClick={() => move(1)} />
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-day-lbl">
            {w}
          </div>
        ))}
        {cells.map((c, k) => {
          const ds = iso(y, c.m, c.d);
          const disabled = c.other || (minDate ? ds < minDate : false) || (maxDate ? ds > maxDate : false) || (!c.other && !!isDisabled?.(ds));
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              className={cx('cal-day', c.other && 'other-month', ds === today && 'today', ds === sel && 'selected')}
              style={disabled && !c.other ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
              onClick={() => {
                if (!disabled) set(ds);
              }}
              aria-label={ds}
            >
              {c.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Modal({
  open = true,
  title,
  eyebrow,
  danger,
  wide,
  footer,
  onClose,
  children,
}: {
  open?: boolean;
  title: string;
  eyebrow?: string;
  danger?: boolean;
  wide?: boolean;
  footer?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose costuma ser uma função nova a cada render; guardar numa ref evita refazer os efeitos.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Renderiza no <body>: um ancestral com backdrop-filter/transform (ex.: a topbar) prenderia o position: fixed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  // Foca o primeiro campo só quando o modal abre (não a cada digitação).
  useEffect(() => {
    if (open && mounted) ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Fechar"])')?.focus();
  }, [open, mounted]);
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fx-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current?.();
      }}
    >
      <div ref={ref} className={cx('fx-modal', wide && 'wide', danger && 'danger')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="fx-modal-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h3 className="fx-modal-title" style={{ marginTop: eyebrow ? 4 : 0 }}>
              {title}
            </h3>
          </div>
          <IconButton icon="x" label="Fechar" onClick={() => closeRef.current?.()} iconSize={20} />
        </div>
        <div className="fx-modal-body">{children}</div>
        {footer ? <div className="fx-modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function CopyButton({ text, label = 'Copiar', size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cx('btn', 'btn-ghost', size === 'sm' && 'btn-sm')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copie o link:', text);
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} />
      {copied ? 'Copiado' : label}
    </button>
  );
}
