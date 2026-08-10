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
