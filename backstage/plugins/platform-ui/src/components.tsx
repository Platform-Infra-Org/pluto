import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { Sprite, SPRITE_SIZE, spriteRects, TEMPLE, POTION } from './sprites';

/**
 * Renders a pixel grid as SVG rects. `shape-rendering: crispEdges` is what keeps
 * the edges hard at every size — without it the browser antialiases the pixels
 * back into a smooth shape.
 */
export function PixelSprite({
  sprite,
  className,
}: {
  sprite: Sprite;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {spriteRects(sprite).map(r => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}

/**
 * A potion whose liquid is a given colour: the glass in the current text
 * colour, the contents in `liquid`.
 *
 * Two passes over one sprite grid rather than two sprites, so the glass and
 * what is inside it can never drift out of alignment.
 */
export function PixelPotion({
  liquid,
  className,
}: {
  liquid: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <g fill={liquid}>
        {spriteRects(POTION, '~').map(r => (
          <rect key={`l-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
        ))}
      </g>
      <g fill="currentColor">
        {spriteRects(POTION, '#').map(r => (
          <rect key={`g-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
        ))}
      </g>
    </svg>
  );
}

/**
 * An empty list, framed as a panel rather than left as a stray sentence.
 *
 * The hint is the part that earns its place: a heading saying NO DATA tells
 * someone what they can already see, while the hint says what would put
 * something here. The sprite is decorative and bobs under the motion rules.
 */
export function EmptyState({
  sprite,
  title = 'No data',
  hint,
}: {
  sprite: Sprite;
  title?: string;
  hint: string;
}) {
  return (
    <div className="sc-empty">
      <PixelSprite sprite={sprite} className="sc-state-ic" />
      <div className="sc-empty-title">{title}</div>
      <div className="sc-empty-hint">{hint}</div>
    </div>
  );
}

/**
 * The Platform logo glyph. `app.branding.mark` replaces it with an image drawn
 * over the same tile: the image keeps its own colors where it is opaque, and
 * its transparent areas show the tile, which follows the color picker.
 *
 * Without that config it falls back to the built-in glyph — an ancient Greek
 * temple facade (pediment, columns, stylobate), the temple resting on its
 * raised platform — which uses `currentColor`, so it inherits whatever color
 * the surrounding mark tile sets.
 *
 * See TechDocs → How-to → *Change the logo, favicon and title*.
 */
export function PlatformMark({ className }: { className?: string }) {
  const mark = useApi(configApiRef).getOptionalString('app.branding.mark');
  if (mark) {
    // Decorative: every tile that renders the mark is inside a link or heading
    // that already names the product.
    return <img className={className} src={mark} alt="" aria-hidden="true" />;
  }
  return <PixelSprite sprite={TEMPLE} className={className} />;
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
    // Backdrop click closes; the dialog itself swallows the click. Both are
    // presentational — Escape and the footer buttons are the keyboard paths.
    <div className="sc sc-overlay" role="presentation" onClick={onClose}>
      <div
        className="sc-dialog"
        role="presentation"
        onClick={e => e.stopPropagation()}
      >
        <div className="sc-dialog-h">{title}</div>
        <div className="sc-dialog-b">{children}</div>
        {footer && <div className="sc-dialog-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
