/**
 * What `./branding` resolves to under Jest.
 *
 * The real module calls `import.meta.webpackContext`, which only exists inside
 * the bundler: a browser cannot list a directory, and that glob is what makes
 * the branding folder drop-in. Jest parses the file as CommonJS, where
 * `import.meta` is a *syntax* error — so it cannot be guarded at runtime, only
 * substituted.
 *
 * An empty map is also the honest fixture: it is exactly what a checkout with
 * no images in the folder produces, and the built-in pixel art is the
 * documented fallback for that case.
 */
export const BRANDING_IMAGES: Record<string, string[]> = {};
