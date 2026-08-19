/**
 * Walking the infra coordinate tree, client-side.
 *
 * The config API hands back the whole tree in one call — nested objects keyed
 * by name (space -> network -> region -> island) with a sorted array of
 * environment names at the leaf. Rather than teach DynamicSelect about trees,
 * or ask the config API for a per-level endpoint, each level's options are
 * resolved here from the ancestors the form already holds. Pure, so it is the
 * cheapest part of the cascade to test.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Descend a dotted path (`coordinates.prod`), or return the payload unchanged. */
export function pickPath(data: unknown, path?: string): unknown {
  if (!path) return data;
  let node: unknown = data;
  for (const key of path.split('.')) {
    if (!isRecord(node)) return undefined;
    node = node[key];
  }
  return node;
}

/**
 * The options for the level below `keys`.
 *
 * `undefined` means "not answerable yet" — an ancestor is unset, or names a
 * value the tree no longer has. That is deliberately distinct from `[]`, which
 * means the branch exists and is empty: the first renders a disabled field
 * asking for the parent, the second an empty list.
 */
export function walkTree(root: unknown, keys: string[]): string[] | undefined {
  let node: unknown = root;
  for (const key of keys) {
    if (!key || !isRecord(node)) return undefined;
    if (!(key in node)) return undefined;
    node = node[key];
  }
  if (Array.isArray(node)) return node.map(String);
  if (isRecord(node)) return Object.keys(node);
  return undefined;
}
