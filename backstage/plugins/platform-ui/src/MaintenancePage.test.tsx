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

  it('sizes the sprite through the shared idiom, not the SVG default', () => {
    // jsdom has no layout engine, so nothing here can assert real pixels —
    // that's exactly why an unsized <svg viewBox="0 0 16 16"> (falling back to
    // the ~300x150 replaced-element default) shipped green before. Assert the
    // idiom every other sprite call site uses instead: `.sc-state-ic` sizes
    // the svg to 32px inside `.sc-empty`, the wrapper that centres it
    // (styles.ts, ~1219-1232).
    const { container } = render(<MaintenancePage />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('sc-state-ic');
    expect(svg?.closest('.sc-empty')).not.toBeNull();
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
