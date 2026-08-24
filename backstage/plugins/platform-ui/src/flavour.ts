/**
 * Optional fantasy naming for navigation entries.
 *
 * The boundary this rests on: a label naming a **screen** is decoration, and
 * someone who cannot find "Requests" finds it one click later. A label naming a
 * **state** is a record — QUEST FAILED in an audit trail is a support ticket.
 * Screens may be renamed here; states may not, and nothing in this module can
 * reach them.
 *
 * Off unless `app.branding.flavour: fantasy` is set.
 */
export type Flavour = 'fantasy' | undefined;

/**
 * Screens this app renames regardless of flavour.
 *
 * `Create` is Backstage's own nav title. The screen files requests of several
 * kinds — CREATE and DELETE today, UPDATE later — so naming it after one of
 * them reads as a filter over the others. The request `kind` values themselves
 * are records and are untouched.
 */
const BASE_SCREENS: Record<string, string> = {
  Create: 'New Request',
};

/** Screen names only. Deliberately short: three entries people navigate by. */
const FANTASY_SCREENS: Record<string, string> = {
  Requests: 'Quests',
  'New Request': 'Summon',
  Catalog: 'Atlas',
};

export function screenName(title: string, flavour: Flavour): string {
  // Base rename first, then flavour on top of the result — so the fantasy map
  // is keyed on what this app calls the screen, not on what Backstage called it.
  const base = BASE_SCREENS[title] ?? title;
  if (flavour !== 'fantasy') return base;
  return FANTASY_SCREENS[base] ?? base;
}
