/**
 * Editing a resource's data at every level, not just the top one.
 *
 * The edit dialog used to render one level: scalars became inputs, and anything
 * nested became a JSON blob in a textarea. That made the common case — change
 * one field inside one nested object — an exercise in hand-editing JSON, with a
 * syntax error as the failure mode. The read-only views (resource data, the
 * delete confirmation) had already been showing the whole document as a tree;
 * this is the same shape, editable.
 *
 * Leaves are the only editable things. A container's *shape* is never edited
 * here — no adding keys, no removing array elements — because the resource's
 * shape is the workflow's contract, and a dialog that can silently drop a key
 * the template depends on is the bug this replaces, not an improvement on it.
 */

/** A scalar the form can render as a single input. */
export type Leaf = {
  /** Keys and array indices from the document root, in order. */
  path: Array<string | number>;
  /** The value as the form shows it. */
  value: string;
  /** What it was, so the merge can put the same type back. */
  type: 'string' | 'number' | 'boolean' | 'null';
};

const isContainer = (v: unknown): v is Record<string, unknown> | unknown[] =>
  v !== null && typeof v === 'object';

/**
 * A stable key for a path.
 *
 * JSON rather than a delimiter join: a resource key may legitimately contain a
 * dot (`app.kubernetes.io/name` is an ordinary annotation shape), and a joined
 * path would then be ambiguous about where one segment ends.
 */
export const pathKey = (path: Array<string | number>): string =>
  JSON.stringify(path);

/** Every editable scalar in the document, depth-first, in document order. */
export function leavesOf(value: unknown, path: Array<string | number> = []): Leaf[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => leavesOf(v, [...path, i]));
  }
  if (isContainer(value)) {
    return Object.entries(value).flatMap(([k, v]) => leavesOf(v, [...path, k]));
  }
  const t = typeof value;
  let type: Leaf['type'] = 'string'; // strings, and anything exotic, shown as text
  if (value === null) type = 'null';
  else if (t === 'number' || t === 'boolean') type = t;
  return [
    {
      path,
      // null renders as an empty field: showing the string "null" invites
      // someone to edit around it, and an empty box reads as "no value".
      value: value === null ? '' : String(value),
      type,
    },
  ];
}

/** Deep structural copy, so a merge never mutates what the dialog still shows. */
function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as unknown as T;
  if (isContainer(v)) {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, clone(x)]),
    ) as T;
  }
  return v;
}

export type DeepMergeResult = {
  /** The whole document, with edited leaves replaced. Always complete. */
  data: Record<string, unknown>;
  /** Keyed by `pathKey`. Non-empty means: do not submit. */
  errors: Record<string, string>;
};

/**
 * Apply edited leaves over the original document.
 *
 * Everything the form did not touch is carried through by cloning first, which
 * keeps the guarantee the one-level version had: the update workflow overwrites
 * the data file with whatever it is given, so a partial document here deletes
 * fields in Git.
 *
 * Each value is coerced back to the type its leaf already had, so
 * `retentionDays: 30` does not become `"30"` on every edit. A leaf that was
 * `null` stays null while the field is empty — an empty box means "still no
 * value", not "the empty string".
 */
export function mergeDeepEdits(
  original: Record<string, unknown>,
  leaves: Leaf[],
  edits: Record<string, string>,
): DeepMergeResult {
  const data = clone(original);
  const errors: Record<string, string> = {};

  for (const leaf of leaves) {
    const key = pathKey(leaf.path);
    if (!(key in edits)) continue;
    const raw = edits[key];

    let next: unknown;
    if (leaf.type === 'number') {
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n)) {
        errors[key] = 'must be a number';
        continue;
      }
      next = n;
    } else if (leaf.type === 'boolean') {
      if (raw !== 'true' && raw !== 'false') {
        errors[key] = 'must be true or false';
        continue;
      }
      next = raw === 'true';
    } else if (leaf.type === 'null') {
      next = raw === '' ? null : raw;
    } else {
      next = raw;
    }

    // Walk to the leaf's parent. Containers are guaranteed to exist because
    // every path came from `leavesOf` over this same document.
    let parent: any = data;
    for (const seg of leaf.path.slice(0, -1)) parent = parent[seg];
    parent[leaf.path[leaf.path.length - 1]] = next;
  }

  return { data, errors };
}
