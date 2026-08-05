/**
 * Every image under this directory, grouped by its immediate subfolder.
 *
 * The glob is resolved by the bundler at build time — a browser cannot list a
 * directory, so this is what makes the folder drop-in. The root has to be a
 * literal for the same reason: it is read before any config exists. Config
 * chooses which subfolder to use, not where the root is.
 */
const ctx = (
  import.meta as unknown as {
    webpackContext(
      request: string,
      options?: { recursive?: boolean; regExp?: RegExp },
    ): { keys(): string[]; (id: string): unknown };
  }
).webpackContext('.', {
  recursive: true,
  regExp: /\.(png|jpe?g|webp|gif|svg)$/i,
});

export const BRANDING_IMAGES: Record<string, string[]> = {};

for (const key of ctx.keys().sort()) {
  // './template-headers/amphora.png' -> 'template-headers'
  const dir = key.split('/')[1];
  if (!dir || !key.startsWith(`./${dir}/`)) continue;
  const mod = ctx(key) as string | { default: string };
  (BRANDING_IMAGES[dir] ??= []).push(
    typeof mod === 'string' ? mod : mod.default,
  );
}
