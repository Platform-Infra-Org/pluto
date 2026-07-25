import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

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
  if (!open) return null;
  return (
    <div className="sc sc-overlay" onClick={onClose}>
      <div className="sc-dialog" onClick={e => e.stopPropagation()}>
        <div className="sc-dialog-h">{title}</div>
        <div className="sc-dialog-b">{children}</div>
        {footer && <div className="sc-dialog-f">{footer}</div>}
      </div>
    </div>
  );
}
