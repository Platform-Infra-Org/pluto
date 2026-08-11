/**
 * Which images become the template card headers.
 *
 * Two sources, and the explicit one wins:
 *
 *   `dir`    — a subfolder of packages/app/src/branding, resolved by
 *              `require.context` at BUILD time. A volume mount cannot add to
 *              it: the bundler never saw the files and the URLs are
 *              content-hashed into main.js.
 *   `images` — literal same-origin URLs, read at RUNTIME. Mount files under
 *              packages/app/dist/branding/… and name them here to change the
 *              art without rebuilding the image.
 */
export function resolveHeaderImages(
  cfg: { images?: string[]; dir?: string },
  bundled: Record<string, string[]>,
): string[] {
  const explicit = (cfg.images ?? []).filter(isSameOrigin);
  // An empty or fully-rejected override falls back rather than blanking the
  // headers: an operator who mis-typed a path should see the default art, not
  // an unstyled grid that looks like a failed deploy.
  if (explicit.length) return explicit;
  return bundled[cfg.dir ?? 'template-headers'] ?? [];
}

/**
 * The CSP is `img-src 'self' data:`, so anything cross-origin is blocked by the
 * browser and renders as a missing header. Rejecting here turns a silent blank
 * card into a value that simply never applies.
 */
function isSameOrigin(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}
