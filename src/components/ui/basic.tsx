// Componentes do UI kit Fluxus sem estado (servem em server e client components).
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'confirm';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
}

export function Button({ variant = 'primary', size = 'md', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} {...rest} className={cx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className)}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  target,
}: {
  href: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icon?: IconName;
  children: ReactNode;
  className?: string;
  target?: string;
}) {
  return (
    <a href={href} target={target} rel={target ? 'noreferrer' : undefined} className={cx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className)}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </a>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  iconSize = 18,
  className,
  style,
  type = 'button',
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  iconSize?: number;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className={cx('btn-icon', className)} onClick={onClick} aria-label={label} title={label} style={style}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

export function Field({ label, id, hint, error, className, children }: { label?: string; id?: string; hint?: ReactNode; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx('field', className)}>
      {label ? (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx('form-input', className)} />;
}

export function Select({
  options,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[] }) {
  return (
    <select {...rest} className={cx('form-input', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx('form-input', className)} />;
}

export function Checkbox({
  label,
  name,
  value,
  id,
  checked,
  defaultChecked,
  onChange,
}: {
  label: ReactNode;
  name?: string;
  value?: string;
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="fx-check">
      <input type="checkbox" name={name} value={value} id={id} checked={checked} defaultChecked={defaultChecked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

export function Toggle({
  label,
  name,
  id,
  checked,
  defaultChecked,
  onChange,
}: {
  label?: ReactNode;
  name?: string;
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" name={name} id={id} checked={checked} defaultChecked={defaultChecked} onChange={onChange} />
      <span className="toggle-slider" />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function Card({ title, children, className, style, actions }: { title?: ReactNode; children?: ReactNode; className?: string; style?: CSSProperties; actions?: ReactNode }) {
  return (
    <div className={cx('card', className)} style={style}>
      {title || actions ? (
        <div className="card-head">
          {title ? <h3 className="fx-card-title">{title}</h3> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function KpiCard({ label, sub, value, icon, color = 'var(--brand-text)' }: { label: string; sub?: string; value: ReactNode; icon?: IconName; color?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-row">
        <div style={{ minWidth: 0 }}>
          <p className="kpi-label">{label}</p>
          {sub ? <p className="kpi-sub">{sub}</p> : null}
          <span className="kpi-value">{value}</span>
        </div>
        {icon ? (
          <div className="kpi-icon" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
            <Icon name={icon} size={22} style={{ color }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type BadgeStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
const STATUS_LABELS: Record<BadgeStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

export function StatusBadge({ status, children }: { status: BadgeStatus | string; children?: ReactNode }) {
  const st = status.toLowerCase() as BadgeStatus;
  return <span className={`badge-${st}`}>{children ?? STATUS_LABELS[st] ?? status}</span>;
}

export function PageBadge({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <span className="page-badge">
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function EmptyState({ icon = 'calendar', title, text, action }: { icon?: IconName; title?: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={20} />
      </div>
      {title ? <p className="empty-title">{title}</p> : null}
      {text ? <p className="empty-text">{text}</p> : null}
      {action ?? null}
    </div>
  );
}

const TOAST_ICONS = { success: 'check-circle', error: 'error-circle', info: 'info-circle' } as const;
export function Toast({ type = 'info', children }: { type?: 'success' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={cx('toast', `toast-${type}`)} role="status">
      <Icon name={TOAST_ICONS[type]} size={18} />
      {children}
    </div>
  );
}

/** Aviso fixo dentro da página (mesmo visual do Toast, sem flutuar). */
export function Notice({ type = 'info', children }: { type?: 'success' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={cx('toast', `toast-${type}`, 'notice')} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={TOAST_ICONS[type]} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function ServiceCard({
  name,
  duration,
  price,
  icon = 'cut',
  active,
  onClick,
  description,
}: {
  name: string;
  duration: string;
  price: string;
  icon?: IconName;
  active?: boolean;
  onClick?: () => void;
  description?: string | null;
}) {
  return (
    <button type="button" className={cx('book-service-card', active && 'active')} onClick={onClick} aria-pressed={!!active}>
      <div className={cx('book-service-icon', active && 'active')}>
        <Icon name={icon} size={20} />
      </div>
      <div className="book-service-info">
        <span className="book-service-name">{name}</span>
        {description ? <span className="book-service-desc">{description}</span> : null}
        <span className="book-service-meta">
          <Icon name="time" size={13} />
          {duration}
        </span>
      </div>
      <span className="book-service-price">{price}</span>
      {active ? <Icon name="check-circle" size={20} className="book-service-check" /> : null}
    </button>
  );
}

export function initials(name: string | null | undefined): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export function BarberCard({ name, badge, picture, active, onClick }: { name: string; badge?: string; picture?: string | null; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={cx('book-barber-card', active && 'active')} onClick={onClick} aria-pressed={!!active}>
      {active ? (
        <span className="book-barber-check">
          <Icon name="check" size={13} />
        </span>
      ) : null}
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="book-barber-pic" src={picture} alt="" />
      ) : (
        <div className={cx('book-barber-pic-fallback', active && 'active')}>{initials(name)}</div>
      )}
      <span className="book-barber-name">{name}</span>
      {badge ? <span className="book-barber-badge">{badge}</span> : null}
    </button>
  );
}

export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="step-progress">
      {steps.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          {i > 0 ? <div className={cx('step-line', i <= current && 'filled')} /> : null}
          <div className={cx('step-node', i < current && 'done', i === current && 'active')}>
            <div className="step-dot">{i < current ? <Icon name="check" size={16} /> : String(i + 1)}</div>
            <div className="step-text">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${rating.toFixed(1).replace('.', ',')} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= Math.round(rating) ? 'star-solid' : 'star'} size={size} />
      ))}
    </span>
  );
}
