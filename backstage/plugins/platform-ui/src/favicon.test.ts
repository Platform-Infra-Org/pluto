import { applyScheme, SCHEMES } from './SchemeRoot';

/**
 * The icon links Backstage's own packages/app/public/index.html declares,
 * verbatim. The bug this guards was invisible against a hand-written single
 * `<link rel="icon">`: the generated icon WAS applied, to the first link, and
 * the browser then picked one of the sized ones instead — so the sidebar mark
 * changed and the tab kept Backstage's default.
 */
const INDEX_HTML_ICONS = `
  <link rel="icon" href="/favicon.ico" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
`;

const GENERATED = 'data:image/png;base64,GENERATED';

const hrefsOf = (selector: string) =>
  Array.from(document.querySelectorAll<HTMLLinkElement>(selector)).map(l =>
    l.getAttribute('href'),
  );

/** Colour stops handed to the tile gradient during the last applyScheme(). */
let stops: string[] = [];

describe('generated tab icon', () => {
  beforeEach(() => {
    document.head.innerHTML = INDEX_HTML_ICONS;
    stops = [];
    // jsdom ships no canvas backend, so getContext returns null and the real
    // code bails before publishing. No roundRect here on purpose — that is the
    // branch jsdom and pre-16.4 Safari actually take.
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: () => {},
      beginPath: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      createLinearGradient: () => ({
        addColorStop: (_: number, colour: string) => stops.push(colour),
      }),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
    jest
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue(GENERATED);
  });

  afterEach(() => jest.restoreAllMocks());

  it('updates every icon link, not just the first', () => {
    applyScheme('violet');
    const hrefs = hrefsOf('link[rel~="icon"]');
    // icon x3 + shortcut icon. Fails on the old querySelector: the two sized
    // links keep pointing at Backstage's stock PNGs, and a browser prefers
    // them precisely because they declare a size.
    expect(hrefs).toEqual([GENERATED, GENERATED, GENERATED, GENERATED]);
  });

  it('leaves the non-tab icons alone', () => {
    applyScheme('violet');
    // `rel~="icon"` must not match these single-token rels: apple-touch-icon
    // is the home-screen icon and mask-icon is monochrome Safari pinning, so
    // a PNG data URL in either is wrong.
    expect(hrefsOf('link[rel="apple-touch-icon"]')).toEqual([
      '/apple-touch-icon.png',
    ]);
    expect(hrefsOf('link[rel="mask-icon"]')).toEqual([
      '/safari-pinned-tab.svg',
    ]);
  });

  it('does nothing when the document declares no icon link', () => {
    document.head.innerHTML = '';
    expect(() => applyScheme('violet')).not.toThrow();
  });

  it('paints the tile with the picked accent, like the sidebar gradient', () => {
    // Same two stops as `.sc-nav-mark`'s linear-gradient(135deg, primary,
    // primary / .6) in styles.ts. A flat fill here is what made the tab read
    // as a different object from the sidebar tile.
    applyScheme('blue');
    const blue = SCHEMES.find(s => s.id === 'blue')!.hsl;
    expect(stops).toEqual([`hsl(${blue})`, `hsl(${blue} / .6)`]);
  });

  it('repaints the tile when the scheme changes', () => {
    applyScheme('blue');
    const first = [...stops];
    stops = [];
    applyScheme('amber');
    expect(stops).not.toEqual(first);
    expect(stops[0]).toBe(`hsl(${SCHEMES.find(s => s.id === 'amber')!.hsl})`);
  });

  it('draws the tile from the computed accent, not the record literal', () => {
    // A mode potion sets --sc-primary in CSS, so the record's own hsl is not
    // what the page is painted with. Reading the computed value keeps the tab
    // icon correct for any mode, not just this one.
    const COMPUTED: Record<string, string> = {
      '--sc-primary': '14 88% 55%',
      '--sc-primary-fg': '240 10% 8%',
      '--sc-card': '265 26% 10%',
    };
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({
        getPropertyValue: (p: string) => COMPUTED[p] ?? '',
      } as unknown as CSSStyleDeclaration);
    try {
      applyScheme('greek');
      expect(stops[0]).toBe('hsl(14 88% 55%)');
    } finally {
      spy.mockRestore();
    }
  });
});
