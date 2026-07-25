import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * The Platform logo glyph: an ancient Greek temple facade (pediment, columns,
 * stylobate) — the temple resting on its raised platform. Uses `currentColor`,
 * so it inherits whatever color the surrounding mark tile sets.
 */
export function PlatformMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* pediment (roof) */}
      <path d="M12 3.2 20.6 8.4 3.4 8.4Z" />
      {/* architrave */}
      <rect x="4.2" y="8.7" width="15.6" height="1.5" rx="0.3" />
      {/* columns */}
      <rect x="6" y="10.7" width="1.5" height="6.1" rx="0.2" />
      <rect x="9.4" y="10.7" width="1.5" height="6.1" rx="0.2" />
      <rect x="13.1" y="10.7" width="1.5" height="6.1" rx="0.2" />
      <rect x="16.5" y="10.7" width="1.5" height="6.1" rx="0.2" />
      {/* stylobate (the platform) */}
      <rect x="3.8" y="17.2" width="16.4" height="1.6" rx="0.3" />
      <rect x="2.6" y="19.3" width="18.8" height="1.7" rx="0.4" />
    </svg>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="sc sc-page">{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sc-header">
      <div>
        <h1 className="sc-h1">{title}</h1>
        {subtitle && <div className="sc-sub">{subtitle}</div>}
      </div>
      {actions && <div className="sc-row">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`sc-card ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="sc-card-h">
      <div className="sc-card-title">{title}</div>
      {description && <div className="sc-card-desc">{description}</div>}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="sc-card-b">{children}</div>;
}

type Variant = 'primary' | 'outline' | 'ghost' | 'destructive';
export function Button({
  variant = 'primary',
  size,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm';
}) {
  const v: Record<Variant, string> = {
    primary: 'sc-btn-primary',
    outline: 'sc-btn-outline',
    ghost: 'sc-btn-ghost',
    destructive: 'sc-btn-destructive',
  };
  return (
    <button
      className={`sc-btn ${v[variant]} ${size === 'sm' ? 'sc-btn-sm' : ''} ${className}`}
      {...props}
    />
  );
}

type Tone = 'muted' | 'primary' | 'success' | 'warning' | 'destructive';
export function Badge({
  tone = 'muted',
  dot,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`sc-badge sc-badge-${tone}`}>
      {dot && <span className="sc-dot" />}
      {children}
    </span>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="sc-input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="sc-select" {...props} />;
}

export function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sc-field">
      <label className="sc-label">{label}</label>
      {children}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open || typeof document === 'undefined') return null;
  // Portal to <body> so the overlay escapes any ancestor stacking context
  // (e.g. the React Flow graph card) instead of rendering behind it.
  return createPortal(
    <div className="sc sc-overlay" onClick={onClose}>
      <div className="sc-dialog" onClick={e => e.stopPropagation()}>
        <div className="sc-dialog-h">{title}</div>
        <div className="sc-dialog-b">{children}</div>
        {footer && <div className="sc-dialog-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
