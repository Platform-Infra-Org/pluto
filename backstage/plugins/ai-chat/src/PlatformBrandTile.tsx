import { PlatformMark } from '@internal/plugin-platform-ui';

/**
 * Share Pluto's *actual* configured brand mark with the nav and generated favicon.
 * PlatformMark reads app.branding.mark and falls back to the temple glyph.
 * The surrounding tile uses the very same live --sc-primary palette tokens
 * as the nav / favicon, so switching the color scheme requires no React state.
 */
export function PlatformBrandTile({
  size = 'header',
}: {
  size?: 'header' | 'avatar' | 'empty';
}) {
  return (
    <span
      className={`platform-ai-brand-tile platform-ai-brand-tile--${size}`}
      aria-hidden="true"
    >
      <PlatformMark />
    </span>
  );
}
