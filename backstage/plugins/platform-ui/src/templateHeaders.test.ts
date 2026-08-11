import { templateHeaderCss } from './templateHeaders';

const CARD = '.sc-route-create .MuiCard-root';

describe('templateHeaderCss', () => {
  it('is empty when no images are supplied, so the pixel art stays', () => {
    expect(templateHeaderCss({ images: [] })).toBe('');
  });

  it('cycles the images across card positions', () => {
    const css = templateHeaderCss({ images: ['/a.png', '/b.png'] });
    expect(css).toContain(`${CARD}:nth-child(2n + 1)`);
    expect(css).toContain(`${CARD}:nth-child(2n + 2)`);
    expect(css).toContain('url("/a.png")');
    expect(css).toContain('url("/b.png")');
  });

  it('emits one rule per image', () => {
    const css = templateHeaderCss({ images: ['/a.png', '/b.png', '/c.png'] });
    expect((css.match(/nth-child/g) ?? []).length).toBe(3);
  });

  it('crops rather than squashes, and fills the header', () => {
    const css = templateHeaderCss({ images: ['/a.png'] });
    expect(css).toContain('background-size: cover');
    expect(css).toContain('background-repeat: no-repeat');
  });

  it('applies the configured height and position', () => {
    const css = templateHeaderCss({
      images: ['/a.png'],
      height: '120px',
      position: 'top left',
    });
    expect(css).toContain('height: 120px');
    expect(css).toContain('background-position: top left');
  });

  it('defaults to the current header height', () => {
    expect(templateHeaderCss({ images: ['/a.png'] })).toContain('height: 90px');
  });

  it('escapes quotes in a filename rather than breaking out of url()', () => {
    const css = templateHeaderCss({ images: ['/a"b.png'] });
    expect(css).not.toContain('url("/a"b.png")');
    expect(css).toContain('%22');
  });

  it('colours the title for the image behind it', () => {
    const css = templateHeaderCss({
      images: ['/dark.png', '/bright.png'],
      tones: ['light', 'dark'],
    });
    // Light tone: white text, dark outline.
    expect(css).toContain('color: hsl(0 0% 100%)');
    // Dark tone: ink text, white outline.
    expect(css).toContain('color: hsl(240 10% 8%)');
    expect(css).toContain('text-shadow');
  });

  it('leaves the colour alone when a tone is unknown', () => {
    const css = templateHeaderCss({ images: ['/a.png'], tones: [undefined] });
    expect(css).not.toContain('color:');
    expect(css).not.toContain('text-shadow');
  });

  it('emits no selector that a production build would kill', () => {
    // MUI replaces non-Mui makeStyles names with jss<n> in production, so a
    // selector naming one is dead in the deployed app and alive on the dev
    // server. That is what made the header images look like a browser bug.
    const css = templateHeaderCss({ images: ['/a.png', '/b.png'] });
    expect(css).not.toMatch(/class\*="Backstage/);
    expect(css).not.toContain('ItemCardHeader');
    expect(css).toContain('.sc-route-create .MuiCard-root');
    expect(css).toContain('> .MuiBox-root:first-child');
  });
});
