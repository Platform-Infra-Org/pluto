import { SuspendedNode } from '@internal/plugin-platform-common';

/**
 * Which supplied outputs a resume request may set, and what is still missing.
 *
 * Two rules, both taken from the step's own declaration rather than from
 * anything configured here:
 *
 * - A parameter the step did not declare as `valueFrom: supplied: {}` is
 *   dropped. Argo rejects it, and a request that half-applies is worse than one
 *   refused whole.
 * - A parameter the step declared **without a default** must be answered. Argo
 *   treats a default as "resume without this if you like"; its absence is the
 *   workflow author saying the answer is load-bearing.
 * - A parameter with an `enum` accepts only one of its listed values. The check
 *   is here as well as in the form because a form is a convenience, not a
 *   boundary.
 *
 * Declared defaults fill in for fields left blank, so a resume never silently
 * sends an empty string where the workflow expected a value.
 */
export function filterSuppliedOutputs(
  node: SuspendedNode,
  parameters: Record<string, string> | undefined,
): {
  accepted: Record<string, string>;
  rejected: string[];
  missing: string[];
  invalid: Array<{ name: string; allowed: string[] }>;
} {
  const declared = new Map(node.suppliedOutputs.map(o => [o.name, o]));
  const accepted: Record<string, string> = {};
  const rejected: string[] = [];
  const invalid: Array<{ name: string; allowed: string[] }> = [];

  for (const [k, v] of Object.entries(parameters ?? {})) {
    const spec = declared.get(k);
    if (!spec) {
      rejected.push(k);
      continue;
    }
    if (v === '') continue; // blank is "not answered", not the empty string
    if (spec.enum && !spec.enum.includes(v)) {
      invalid.push({ name: k, allowed: spec.enum });
      continue;
    }
    accepted[k] = v;
  }

  const missing: string[] = [];
  const badValue = new Set(invalid.map(i => i.name));
  for (const out of node.suppliedOutputs) {
    if (accepted[out.name] !== undefined) continue;
    // Answered with something the enum forbids is a different complaint from
    // not answered. Reporting both tells the approver they left blank a field
    // they just filled in.
    if (badValue.has(out.name)) continue;
    if (out.default !== undefined) {
      accepted[out.name] = out.default;
    } else if (out.required) {
      missing.push(out.name);
    }
  }

  return { accepted, rejected, missing, invalid };
}
