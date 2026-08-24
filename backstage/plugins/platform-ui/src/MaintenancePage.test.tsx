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

  it('draws Pluto as a planet, sized by the stylesheet', () => {
    // jsdom has no layout engine, so nothing here can assert real pixels —
    // that's exactly why an unsized <svg> (falling back to the ~300x150
    // replaced-element default) shipped green before. Assert the idiom
    // instead: `.sc-pluto` is what styles.ts sizes, and the heart is the
    // feature that makes the disc read as Pluto rather than as a coin, so a
    // redraw that loses it should go red here.
    const { container } = render(<MaintenancePage />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('sc-pluto');
    expect(svg?.closest('.sc-empty')).not.toBeNull();
    expect(container.querySelector('.sc-pluto-heart')).not.toBeNull();
  });

  it('paints the glyph from the scheme, not from a fixed colour', () => {
    // The planet keeps greys of its own — it is a photograph's subject, not a
    // themed surface — but the monogram over it must follow the picked potion.
    // styles.ts strokes `.sc-pluto-glyph` with --sc-primary; this pins the
    // hook that rule needs, so renaming one half silently is caught.
    const { container } = render(<MaintenancePage />);
    expect(container.querySelector('.sc-pluto-glyph')).not.toBeNull();
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
