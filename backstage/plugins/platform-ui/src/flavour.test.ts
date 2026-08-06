import { screenName } from './flavour';
import { STATE_SPRITES } from './sprites';

describe('screenName', () => {
  it('leaves every label alone when no flavour is configured', () => {
    expect(screenName('Requests', undefined)).toBe('Requests');
    expect(screenName('Create', undefined)).toBe('Create');
  });

  it('renames the screens it knows when the flavour is fantasy', () => {
    expect(screenName('Requests', 'fantasy')).toBe('Quests');
    expect(screenName('Create', 'fantasy')).toBe('Summon');
    expect(screenName('Catalog', 'fantasy')).toBe('Atlas');
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
});
