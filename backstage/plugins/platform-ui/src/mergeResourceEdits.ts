/**
 * Apply a form's edits over a resource's full data document.
 *
 * The point of this function is what it does *not* do: keys the form never
 * rendered are carried through untouched. The edit dialog used to submit only
 * the scalar keys it could show, and the update workflow overwrites the data
 * file with whatever it is given — so an edit to one string deleted every
 * nested field the resource had. Merging here is what makes that impossible.
 *
 * Edits arrive as strings because they come from form inputs. Each is coerced
 * back to the type the key already had, so `retentionDays: 30` does not become
 * `"30"` in Git on every edit.
 */
export type MergeResult = {
  /** The full document to submit. Always complete, even when `errors` is not empty. */
  data: Record<string, unknown>;
  /** Per-key human-readable problems. Non-empty means: do not submit. */
  errors: Record<string, string>;
};

export function mergeResourceEdits(
  original: Record<string, unknown>,
  edits: Record<string, string>,
): MergeResult {
  const data: Record<string, unknown> = { ...original };
  const errors: Record<string, string> = {};

  for (const [key, raw] of Object.entries(edits)) {
    const before = original[key];

    if (typeof before === 'number') {
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n)) {
        errors[key] = 'must be a number';
        continue;
      }
      data[key] = n;
    } else if (typeof before === 'boolean') {
      if (raw !== 'true' && raw !== 'false') {
        errors[key] = 'must be true or false';
        continue;
      }
      data[key] = raw === 'true';
    } else if (typeof before === 'object' && before !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        errors[key] = 'not valid JSON';
      }
    } else {
      // string, null, or a key the original did not have
      data[key] = raw;
    }
  }

  return { data, errors };
}
