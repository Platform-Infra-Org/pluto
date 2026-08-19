import { MODE_VESSELS, SCHEMES, applyScheme } from './SchemeRoot';

/** WCAG relative luminance for an "H S% L%" triplet. */
function luminance(hsl: string): number {
  const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const lin = (x: number) =>
    x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('colour schemes', () => {
  it('every scheme clears 4.5:1 between its accent and its foreground', () => {
    for (const s of SCHEMES) {
      const ratio = contrast(s.hsl, s.fg);
      expect(`${s.id}:${ratio >= 4.5}`).toBe(`${s.id}:true`);
    }
  });

  it('keeps one potion per design system, with stable ids', () => {
    // An id is the key a browser has already persisted; a label is only what
    // someone reads. A pick that no longer exists degrades to the first bottle
    // rather than throwing.
    expect(SCHEMES.map(s => s.id)).toEqual(['greek', 'hanami', 'nightshade', 'rimefast', 'egyptian', 'foudre', 'slush', 'spiderverse', 'newform', 'hermes', 'papers', 'discord', 'github', 'claude', 'dairy', 'obsidian']);
  });

  it('keeps the vessel-bearing modes contiguous and first', () => {
    // The shelf is meant to read as "the crafted ones, then the brand ones",
    // and that is carried by ORDER alone — nothing on screen labels the
    // groups. Slot a new scheme in at index 2 and the grouping is silently
    // gone, which is exactly the change nobody reviews. Checked as one string
    // so a failure prints the whole shelf rather than an index.
    const shelf = SCHEMES.map(s =>
      s.mode && MODE_VESSELS[s.mode] ? 'V' : '.',
    ).join('');
    const n = Object.keys(MODE_VESSELS).length;
    expect(shelf).toBe('V'.repeat(n) + '.'.repeat(SCHEMES.length - n));
  });

  it('gives every vessel to a mode that is actually on the shelf', () => {
    // A vessel keyed to a mode no scheme carries draws nothing and fails
    // nowhere.
    const modes = new Set(SCHEMES.map(s => s.mode));
    for (const mode of Object.keys(MODE_VESSELS)) {
      expect(`${mode}:${modes.has(mode as never)}`).toBe(`${mode}:true`);
    }
  });

  it('gives each mode to exactly one potion', () => {
    const modes = SCHEMES.filter(s => s.mode).map(s => s.mode);
    expect([...modes].sort()).toEqual(['claude', 'dairy', 'discord', 'egyptian', 'foudre', 'github', 'greek', 'hanami', 'hermes', 'newform', 'nightshade', 'obsidian', 'papers', 'rimefast', 'slush', 'spiderverse']);
    expect(new Set(modes).size).toBe(modes.length);
  });

  it('toggles the mode class on the root element when a mode is picked', () => {
    applyScheme('greek');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(true);
    applyScheme('foudre');
    expect(document.documentElement.classList.contains('sc-greek')).toBe(false);
    expect(document.documentElement.classList.contains('sc-foudre')).toBe(true);
  });

  it('never leaves two modes applied at once', () => {
    // The failure this guards is silent and total: a mode class left behind is
    // a second complete palette still matching, and which one wins is then
    // decided by stylesheet order rather than by what was clicked. Every mode
    // must be cleared on every pick, not only the one being replaced.
    const ALL = ['sc-greek', 'sc-hanami', 'sc-nightshade', 'sc-rimefast', 'sc-egyptian', 'sc-foudre', 'sc-slush', 'sc-spiderverse', 'sc-newform', 'sc-hermes', 'sc-papers', 'sc-discord', 'sc-github', 'sc-claude', 'sc-dairy', 'sc-obsidian'];
    const classesFor = (id: string) => {
      applyScheme(id);
      return ALL.filter(c => document.documentElement.classList.contains(c));
    };
    // Walk the whole shelf: every pick must leave exactly one mode standing.
    for (const s of SCHEMES) {
      expect(`${s.id}:${classesFor(s.id).join(',')}`).toBe(
        `${s.id}:sc-${s.mode}`,
      );
    }
  });
});
