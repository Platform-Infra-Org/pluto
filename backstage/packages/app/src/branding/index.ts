/**
 * Every image under this directory, grouped by its immediate subfolder.
 *
 * The glob is resolved by the bundler at build time — a browser cannot list a
 * directory, so this is what makes the folder drop-in. The root has to be a
 * literal for the same reason: it is read before any config exists. Config
 * chooses which subfolder to use, not where the root is.
 *
 * `require.context` rather than `import.meta.webpackContext`, which does the
 * same job: the latter is a *syntax* error the moment this file is parsed as
 * CommonJS, which is how Jest loads it, and a syntax error cannot be guarded at
 * runtime. `require.context` is ordinary CommonJS to a parser and simply does
 * not exist outside a bundler, so the guard below is enough — no test stub, no
 * moduleNameMapper, no dependence on how Jest resolves this path.
 */
type RequireContext = {
  keys(): string[];
  (id: string): unknown;
};

/**
 * The call has to appear literally as `require.context(...)`, and it has to be
 * the *only* mention of `require` in the file.
 *
 * Two earlier shapes both failed, each with the same warning — "require
 * function is used in a way in which dependencies cannot be statically
 * extracted" — after which the bundler builds no context at all and the folder
 * silently contributes nothing:
 *
 *   const req = require; req.context(...)          // aliased
 *   typeof require.context === 'function' ? ...    // guarded by inspection
 *
 * So there is no guard. Outside a bundler `require.context` is undefined and
 * calling it throws, which is a *runtime* error and therefore catchable — the
 * thing `import.meta.webpackContext` could never offer, being a syntax error.
 * The cast is erased at emit, leaving exactly the shape rspack looks for.
 */
let ctx: RequireContext | undefined;
try {
  ctx = (
    require as never as {
      context(d: string, r?: boolean, re?: RegExp): RequireContext;
    }
  ).context('.', true, /\.(png|jpe?g|webp|gif|svg)$/i);
} catch {
  ctx = undefined;
}

export const BRANDING_IMAGES: Record<string, string[]> = {};

// Absent under Jest, where there is no bundler to resolve the glob. An empty
// map is what a checkout with no images in the folder produces anyway, and the
// built-in pixel art is the documented fallback for that.
if (ctx) {
  for (const key of ctx.keys().sort()) {
    // './template-headers/amphora.png' -> 'template-headers'
    const dir = key.split('/')[1];
    if (!dir || !key.startsWith(`./${dir}/`)) continue;
    const mod = ctx(key) as string | { default: string };
    (BRANDING_IMAGES[dir] ??= []).push(
      typeof mod === 'string' ? mod : mod.default,
    );
  }
}
