import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MaintenancePage } from './MaintenancePage';

describe('MaintenancePage', () => {
  it('says the line in Hebrew, marked as Hebrew', () => {
    // lang and dir so it is announced and ordered correctly whatever the font
    // resolves to — the typography fix is separate from the semantics.
    render(<MaintenancePage />);
    const line = screen.getByText('פלוטו בנסיגה...');
    expect(line).toHaveAttribute('lang', 'he');
    expect(line).toHaveAttribute('dir', 'rtl');
  });

  it('explains itself in English too', () => {
    render(<MaintenancePage />);
    // The explanation paragraph itself, not a word ("maintenance") that also
    // appears in the heading — that match would still pass with the
    // paragraph deleted entirely.
    expect(
      screen.getByText(/new requests are paused/i),
    ).toBeInTheDocument();
  });

  it('shows the Pluto photograph, pixelated by the stylesheet', () => {
    // jsdom has no layout engine, so nothing here can assert real pixels —
    // that's exactly why an unsized <svg> (falling back to the ~300x150
    // replaced-element default) shipped green before. Assert the idiom
    // instead: `.sc-pluto-disc` is the hook styles.ts sizes and applies
    // `image-rendering: pixelated` to, and the src must be the inlined photo
    // rather than a remote URL — the CSP is `img-src 'self' data:`, so a
    // hotlink would fail silently in the browser and green here.
    const { container } = render(<MaintenancePage />);
    const img = container.querySelector('img.sc-pluto-disc');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('paints the glyph from the scheme, not from a fixed colour', () => {
    // The photograph keeps colours of its own — it is a photograph's subject,
    // not a themed surface — but the monogram over it must follow the picked
    // potion. styles.ts strokes `.sc-pluto-glyph` with --sc-primary; this pins
    // the hook that rule needs, so renaming one half silently is caught.
    const { container } = render(<MaintenancePage />);
    expect(container.querySelector('svg.sc-pluto-glyph')).not.toBeNull();
  });

  it('carries no colour of its own', () => {
    // It must follow the picked potion like every other surface. A hex, hsl()/rgb()/rgba() literal, or any inline style=
    // (which could carry a colour the regex below cannot parse) is a scheme
    // that stopped theming. This page has no inline styles today and should
    // never acquire one.
    const { container } = render(<MaintenancePage />);
    expect(container.innerHTML).not.toMatch(
      /#[0-9a-f]{3,6}\b|hsl\(\s*\d|rgba?\(\s*\d|style=/i,
    );
  });
});
