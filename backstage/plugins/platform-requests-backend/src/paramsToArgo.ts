/**
 * Coerce a request's `params` into Argo workflow parameters — one named Argo
 * parameter per request field, instead of one JSON blob a template has to parse
 * back apart. Pure.
 */

/**
 * Argo takes `submitOptions.parameters` as a list of `k=v` **strings**, split on
 * the first `=`. So a name carrying `=`, a space or a newline does not produce a
 * rejected submit — it produces a silently misparsed one, landing under a
 * different name (or truncating the value). Reject it here, where the offending
 * name can still be named.
 */
const INVALID_NAME = /[=\s]/;

export function paramsToArgo(
  params: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    if (INVALID_NAME.test(name)) {
      throw new Error(
        `invalid Argo parameter name '${name}': must not contain '=', whitespace or a newline`,
      );
    }
    // Skipped, not sent as ''. An optional field the user left blank must stay
    // absent, or the template sees an empty string it cannot tell apart from a
    // deliberately empty one — and loses its own declared default with it.
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') out[name] = value;
    // Objects and arrays travel as JSON; numbers and booleans stringify.
    else if (typeof value === 'object') out[name] = JSON.stringify(value);
    else out[name] = String(value);
  }
  return out;
}
