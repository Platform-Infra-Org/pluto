/**
 * Argo's loop-iteration suffix.
 *
 * A `withItems` step gets a `displayName` of `provision(0:{"name":"bucket-a"})`
 * — the whole item payload, so the label is longest exactly when the request
 * carries the most data. The index is the only part that distinguishes one
 * iteration from another, so it is kept and the payload is dropped.
 *
 * Anchored to the end of the string, and the payload is matched greedily, so a
 * payload containing its own `(`/`)` is consumed whole rather than cut at the
 * first inner bracket. The match also starts at the first `(` *followed by
 * digits and a colon*, so a step whose own name has parentheses —
 * `deploy (canary)` — keeps them.
 */
const LOOP_SUFFIX = /\((\d+):[\s\S]*\)$/;

/** One character, so the truncation costs one character of budget. */
const ELLIPSIS = '…';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = Math.max(0, max - ELLIPSIS.length);
  // A cut between the two halves of a surrogate pair (an emoji in a step name)
  // renders as a replacement glyph, so back off one unit rather than split it.
  const prev = s.charCodeAt(end - 1);
  if (end > 0 && prev >= 0xd800 && prev <= 0xdbff) end -= 1;
  return s.slice(0, end) + ELLIPSIS;
}

/**
 * A workflow node name that fits in a node box.
 *
 * Shortening is only half the fix — `WorkflowGraph` also clips. This keeps the
 * label *readable*; the clip is what guarantees it stays inside the box.
 */
export function nodeLabel(raw: string, max = 28): string {
  const m = LOOP_SUFFIX.exec(raw);
  const short = m ? `${raw.slice(0, m.index)} [${m[1]}]`.trim() : raw;
  // An unnamed node would otherwise render as a blank box with no way to tell
  // which step it is; the raw value is at least addressable.
  return truncate(short, max) || raw;
}
