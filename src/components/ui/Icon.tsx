import type { CSSProperties } from 'react';
import { ICONS, type IconName } from './icons';
import { cx } from './cx';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
  spin?: boolean;
  /** Para ícone com significado próprio (sem texto ao lado). */
  label?: string;
}

export function Icon({ name, size = 20, style, className, spin, label }: IconProps) {
  const def = ICONS[name];
  if (!def) return <span className="fx-icon" style={{ width: size, height: size, ...style }} />;
  const outline = def.s === 'o';
  return (
    <svg
      className={cx('fx-icon', spin && 'animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={style}
      fill={outline ? 'none' : 'currentColor'}
      stroke={outline ? 'currentColor' : undefined}
      strokeWidth={outline ? 1.5 : undefined}
      dangerouslySetInnerHTML={{ __html: def.d }}
    />
  );
}
