import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { BOONS, BOON_LABELS } from './hades';
import { BoonPicker } from './BoonPicker';

describe('BoonPicker', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-boon');
  });

  it('offers every boon as a named button', () => {
    render(<BoonPicker />);
    for (const b of BOONS) {
      expect(screen.getByRole('button', { name: BOON_LABELS[b] })).toBeInTheDocument();
    }
  });

  it('equips the Hades potion and the boon in one act', () => {
    // "Pick a symbol and the theme changes" has to be true from any starting
    // scheme, so the pick sets both.
    render(<BoonPicker />);
    fireEvent.click(screen.getByRole('button', { name: BOON_LABELS.zeus }));
    expect(document.documentElement).toHaveClass('sc-hades');
    expect(document.documentElement.getAttribute('data-boon')).toBe('zeus');
    expect(localStorage.getItem('platform-boon')).toBe('zeus');
  });

  it('names the equipped boon in text', () => {
    // Nothing conveys state through motion alone: with animation off, the
    // equipped god must still be readable.
    render(<BoonPicker />);
    fireEvent.click(screen.getByRole('button', { name: BOON_LABELS.ares }));
    expect(screen.getByText(BOON_LABELS.ares, { selector: ':not(button)' })).toBeInTheDocument();
  });

  it('marks the equipped boon as pressed', () => {
    render(<BoonPicker />);
    const zeus = screen.getByRole('button', { name: BOON_LABELS.zeus });
    fireEvent.click(zeus);
    expect(zeus).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: BOON_LABELS.ares })).toHaveAttribute(
      'aria-pressed', 'false',
    );
  });

  it('shows the stored boon as pressed and named on mount', () => {
    // Applying `data-boon` on mount is SchemeRoot's job now (it wraps every
    // route; see SchemeRoot.test.tsx for that guard) — BoonPicker only owns
    // its own display state, which still has to start in step with whatever
    // was last equipped rather than defaulting to nothing.
    localStorage.setItem('platform-boon', 'artemis');
    render(<BoonPicker />);
    expect(screen.getByRole('button', { name: BOON_LABELS.artemis })).toHaveAttribute(
      'aria-pressed', 'true',
    );
    expect(
      screen.getByText(BOON_LABELS.artemis, { selector: ':not(button)' }),
    ).toBeInTheDocument();
  });

  it('shows the no-boon fallback for a corrupted stored value, not a blank label', () => {
    // A hand-edited or stale localStorage value must not become `boon` state
    // verbatim — BOON_LABELS has no entry for it, and rendering `undefined`
    // is a blank line beside the wheel rather than the fallback text that is
    // supposed to name the state with motion off.
    localStorage.setItem('platform-boon', 'garbage');
    render(<BoonPicker />);
    expect(screen.getByText('No boon — the house of Hades')).toBeInTheDocument();
  });
});
