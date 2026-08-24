import { screenName } from './flavour';
import { STATE_SPRITES } from './sprites';

describe('screenName', () => {
  it('leaves every label alone when no flavour is configured', () => {
    expect(screenName('Requests', undefined)).toBe('Requests');
    expect(screenName('Create', undefined)).toBe('New Request');
  });

  it('renames the screens it knows when the flavour is fantasy', () => {
    expect(screenName('Requests', 'fantasy')).toBe('Quests');
    expect(screenName('Create', 'fantasy')).toBe('Summon');
    expect(screenName('Catalog', 'fantasy')).toBe('Atlas');
    expect(screenName('New Request', 'fantasy')).toBe('Summon');
  });

  it('passes through a screen it has no name for', () => {
    expect(screenName('Settings', 'fantasy')).toBe('Settings');
  });

  it('never touches a request state', () => {
    // States are records. Whatever the flavour, they come back byte-identical.
    for (const state of Object.keys(STATE_SPRITES)) {
      expect(screenName(state, 'fantasy')).toBe(state);
    }
    // Including the human-facing spellings used in the badges.
    for (const label of ['Pending approval', 'Approved', 'Rejected', 'Failed']) {
      expect(screenName(label, 'fantasy')).toBe(label);
    }
  });

  describe('base screen names', () => {
    it('renames Create to New Request', () => {
      // The screen creates requests of several kinds — CREATE and DELETE today,
      // UPDATE later — so naming it after one of them reads as a filter.
      expect(screenName('Create', undefined)).toBe('New Request');
    });

    it('still reaches the fantasy name through the rename', () => {
      // Order matters: rename first, then flavour. Keying fantasy off the old
      // literal is how Summon would silently stop working.
      expect(screenName('Create', 'fantasy')).toBe('Summon');
    });

    it('leaves other screens alone', () => {
      expect(screenName('Requests', undefined)).toBe('Requests');
      expect(screenName('Catalog', undefined)).toBe('Catalog');
    });
  });
});
