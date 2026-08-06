import { recordVisit, isRecordable, Visit } from './useVisits';

const visit = (path: string, at = '2026-08-06T10:00:00.000Z'): Visit => ({
  path,
  title: path.replace('/', '') || 'Home',
  at,
});

describe('recordVisit', () => {
  it('puts the newest first', () => {
    const list = recordVisit([visit('/catalog')], visit('/requests'));
    expect(list.map(v => v.path)).toEqual(['/requests', '/catalog']);
  });

  it('moves a revisited page up instead of duplicating it', () => {
    const list = recordVisit(
      [visit('/requests'), visit('/catalog')],
      visit('/catalog', '2026-08-06T11:00:00.000Z'),
    );
    expect(list.map(v => v.path)).toEqual(['/catalog', '/requests']);
    expect(list[0].at).toBe('2026-08-06T11:00:00.000Z');
  });

  it('caps the log', () => {
    let list: Visit[] = [];
    for (let i = 0; i < 30; i++) list = recordVisit(list, visit(`/p${i}`), 20);
    expect(list).toHaveLength(20);
    // The cap drops the oldest, not the newest.
    expect(list[0].path).toBe('/p29');
  });

  it('keeps an empty log valid', () => {
    expect(recordVisit([], visit('/catalog'))).toHaveLength(1);
  });
});

describe('isRecordable', () => {
  it('records a real page', () => {
    expect(isRecordable('/catalog')).toBe(true);
    expect(isRecordable('/requests/12')).toBe(true);
  });

  it('skips home, which is where the list is shown', () => {
    expect(isRecordable('/')).toBe(false);
  });

  it('skips the sign-in handshake coming back', () => {
    // Not somewhere anyone chose to go.
    expect(isRecordable('/?state=abc123')).toBe(false);
    expect(isRecordable('/catalog?state=xyz')).toBe(false);
  });

  it('skips an empty path', () => {
    expect(isRecordable('')).toBe(false);
  });
});
