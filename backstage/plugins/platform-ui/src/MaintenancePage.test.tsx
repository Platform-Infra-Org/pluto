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

  it('carries no colour of its own', () => {
    // It must follow the picked potion like every other surface, including the
    // Hades boons. A hex, hsl()/rgb()/rgba() literal, or any inline style=
    // (which could carry a colour the regex below cannot parse) is a scheme
    // that stopped theming. This page has no inline styles today and should
    // never acquire one.
    const { container } = render(<MaintenancePage />);
    expect(container.innerHTML).not.toMatch(
      /#[0-9a-f]{3,6}\b|hsl\(\s*\d|rgba?\(\s*\d|style=/i,
    );
  });
});
