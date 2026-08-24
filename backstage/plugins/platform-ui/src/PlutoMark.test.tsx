import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { PlutoMark } from './PlutoMark';

describe('PlutoMark', () => {
  it('inlines the photograph rather than hotlinking it', () => {
    // The CSP is `img-src 'self' data:`. A remote URL would fail silently in
    // the browser while passing every other assertion here, so the data:
    // prefix is the thing worth pinning.
    const { container } = render(<PlutoMark />);
    const img = container.querySelector('img.sc-pluto-disc');
    expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('strokes the glyph from the scheme, not a fixed colour', () => {
    // styles.ts strokes `.sc-pluto-glyph` with --sc-primary so the mark
    // follows the picked potion. This pins the hook that rule needs.
    const { container } = render(<PlutoMark />);
    expect(container.querySelector('svg.sc-pluto-glyph')).not.toBeNull();
  });

  it('carries no colour of its own', () => {
    // The photograph keeps its own colours — it is a photograph's subject,
    // not a themed surface — but nothing here may hardcode one.
    const { container } = render(<PlutoMark />);
    expect(container.innerHTML).not.toMatch(
      /#[0-9a-f]{3,6}\b|hsl\(\s*\d|rgba?\(\s*\d|style=/i,
    );
  });

  it('is announced where it illustrates, and silent where it decorates', () => {
    // On the maintenance page it is the illustration for the message beside
    // it; in the home page's spare cell it says nothing a screen reader
    // needs, and an "image: Pluto" announcement there is pure noise.
    const named = render(<PlutoMark />).container.querySelector('img');
    expect(named).toHaveAttribute('alt', 'Pluto');
    expect(named).not.toHaveAttribute('aria-hidden');

    const deco = render(<PlutoMark decorative />).container.querySelector('img');
    expect(deco).toHaveAttribute('alt', '');
    expect(deco).toHaveAttribute('aria-hidden', 'true');
  });
});
