import {
  SecretFieldSpec,
  SuspendedNode,
  SuspendInput,
} from '@internal/plugin-platform-common';

/**
 * Parameter names that carry a credential often enough to be masked on sight.
 *
 * A suspend step's inputs are workflow-authored: whatever the template
 * interpolated ends up here, and the approval panel is the one screen where a
 * human is definitely looking. Over-masking costs an approver one click in the
 * Argo UI; under-masking puts a credential on a screen that promised never to
 * show one.
 */
const SENSITIVE = /(password|passwd|secret|token|credential|api[-_]?key|private[-_]?key)/i;

/**
 * Mask the values an approver must not see, keeping every key visible.
 *
 * Two rules, and the second exists because the first cannot be complete:
 *
 * 1. Any parameter whose name matches a field in the request's `secretSpec` —
 *    the values this platform itself materialised.
 * 2. Any parameter whose name looks like a credential.
 *
 * Matching on **values** is deliberately not attempted: the plaintext is
 * cleared at approval and only ever exists inside the request's Kubernetes
 * Secret, so the backend has nothing to compare against. That is a property
 * worth keeping, not a gap to close — see the secret-lifecycle docs.
 */
export function maskSuspendInputs(
  nodes: SuspendedNode[],
  secretSpec: SecretFieldSpec[] | undefined,
): SuspendedNode[] {
  const secretNames = new Set(
    (secretSpec ?? []).map(s => s.name.toLowerCase()),
  );
  const mask = (p: SuspendInput): SuspendInput =>
    secretNames.has(p.name.toLowerCase()) || SENSITIVE.test(p.name)
      ? { name: p.name, masked: true }
      : p;
  return nodes.map(n => ({ ...n, inputs: n.inputs.map(mask) }));
}

/**
 * Which supplied outputs a resume request may set.
 *
 * Anything the step did not declare as `valueFrom: supplied: {}` is dropped
 * rather than passed through: Argo rejects it, and a request that half-applies
 * is worse than one that is refused whole. Returns the accepted subset and the
 * names that were dropped, so the caller can say which.
 */
export function filterSuppliedOutputs(
  node: SuspendedNode,
  parameters: Record<string, string> | undefined,
): { accepted: Record<string, string>; rejected: string[] } {
  const allowed = new Set(node.suppliedOutputs);
  const accepted: Record<string, string> = {};
  const rejected: string[] = [];
  for (const [k, v] of Object.entries(parameters ?? {})) {
    if (allowed.has(k)) accepted[k] = v;
    else rejected.push(k);
  }
  return { accepted, rejected };
}
