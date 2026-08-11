/**
 * Split a stored `resultRef` into the refs it actually names.
 *
 * The backend stores whatever the Argo output parameter emitted, verbatim —
 * that string is the audit record and is deliberately not parsed on the way in.
 * A workflow that creates several resources emits a JSON array, which is why
 * splitting happens here, at the point of presentation.
 *
 * Never throws: a value nobody anticipated renders as one opaque ref, which is
 * a wrong-looking link rather than a blank panel where a result should be.
 */
export function parseResultRefs(raw?: string): string[] {
  const value = raw?.trim();
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // The single-resource case, and the overwhelmingly common one: a bare
    // catalog name or a URL, neither of which is valid JSON.
    return [value];
  }

  // Only an array is a list of refs. An object or a bare number is *a* ref that
  // happens to be JSON — spreading an object's values would invent refs out of
  // whatever fields it had.
  if (!Array.isArray(parsed)) return [value];

  return parsed
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean);
}
