/**
 * A string that is itself a serialised JSON document, parsed — or undefined.
 *
 * Objects and arrays only. `JSON.parse` also accepts "42", "true" and "null",
 * but the string "42" is a string: rendering it as a number would claim the
 * workflow receives a number. A string param reaches Argo with its quotes
 * escaped while a nested object arrives clean, so the viewer has to keep the
 * two visibly distinct.
 */
export function parseEmbeddedJson(value: string): unknown | undefined {
  const trimmed = value.trim();
  // Cheap gate before the parse: this runs for every leaf on every render, and
  // almost every param value is an ordinary string.
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    // typeof null === 'object', so the truthiness check is load-bearing.
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Does anything in this document contain a serialised JSON document?
 *
 * Drives whether the raw/parsed toggle is offered at all. Most requests carry
 * plain params — real nested objects, not dumped strings — and a control that
 * visibly does nothing when pressed is worse than no control.
 *
 * Depth-limited because it walks user-supplied data on every render; a document
 * nested deeper than this is not something the viewer can usefully show anyway.
 */
export function containsEmbeddedJson(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === 'string') return parseEmbeddedJson(value) !== undefined;
  if (Array.isArray(value)) {
    return value.some(v => containsEmbeddedJson(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(v => containsEmbeddedJson(v, depth + 1));
  }
  return false;
}
