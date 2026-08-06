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

/** Screen names only. Deliberately short: three entries people navigate by. */
const FANTASY_SCREENS: Record<string, string> = {
  Requests: 'Quests',
  Create: 'Summon',
  Catalog: 'Atlas',
};

export function screenName(title: string, flavour: Flavour): string {
  if (flavour !== 'fantasy') return title;
  return FANTASY_SCREENS[title] ?? title;
}
