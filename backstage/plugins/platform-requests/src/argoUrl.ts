/**
 * A request's workflow as a link into the Argo Workflows UI, or `undefined`
 * when it cannot be built.
 *
 * `undefined` is the ordinary case, not an error: `platform.argo.uiUrl` is
 * optional (a deployment need not expose the Argo UI at all), and a request
 * only carries a workflow name and namespace once it has been submitted.
 * Callers render the plain name in that case — the same thing they rendered
 * before this existed.
 *
 * The namespace is required rather than defaulted to the configured one. A
 * request that ran in a different namespace would otherwise get a confidently
 * wrong link, and a link that 404s is worse than no link: it reads as "the
 * workflow is gone" rather than "we don't know where it is".
 */
export function argoWorkflowUrl(
  uiUrl: string | undefined,
  namespace: string | undefined,
  name: string | undefined,
): string | undefined {
  if (!uiUrl || !namespace || !name) return undefined;
  // A trailing slash in config is a typo, not an intent — `//workflows/…` is a
  // different path on some ingresses.
  return `${uiUrl.replace(/\/+$/, '')}/workflows/${namespace}/${name}`;
}
