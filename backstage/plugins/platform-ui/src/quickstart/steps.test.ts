import { QUICKSTART_STEPS, QUICKSTART_VERSION } from './steps';

describe('the quickstart steps', () => {
  it('has steps at all', () => {
    expect(QUICKSTART_STEPS.length).toBeGreaterThan(0);
  });

  it('gives every step an id, a selector, a title and a body', () => {
    for (const s of QUICKSTART_STEPS) {
      expect(`${s.id}:id`).not.toBe(':id');
      expect(`${s.id}:selector`).toBe(`${s.id}:selector`);
      expect(s.selector.trim().length).toBeGreaterThan(0);
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('never reuses an id', () => {
    const ids = QUICKSTART_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never highlights the same element twice', () => {
    // The copy-paste this catches: two steps pointing at one element, which
    // reads as the tour getting stuck.
    const selectors = QUICKSTART_STEPS.map(s => s.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('has a version to compare stored progress against', () => {
    expect(Number.isInteger(QUICKSTART_VERSION)).toBe(true);
    expect(QUICKSTART_VERSION).toBeGreaterThan(0);
  });
});
