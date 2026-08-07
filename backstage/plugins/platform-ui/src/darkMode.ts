/**
 * Whether the pixel tokens should use their dark values.
 *
 * `activeThemeId$()` emits `undefined` when the user has not picked a theme —
 * the "Auto" case, which is the default for every new account. Backstage then
 * renders whichever variant matches `prefers-color-scheme`, so treating an
 * absent id as light desynchronises the two: MUI paints its dark palette (white
 * text) while `body { background: hsl(var(--sc-bg)) }` paints our light
 * background, and the app comes up white on white.
 *
 * An explicit choice always wins over the system preference — that is what
 * choosing means.
 */
export function isDarkTheme(
  themeId: string | undefined,
  prefersDark: boolean,
): boolean {
  return themeId ? themeId.includes('dark') : prefersDark;
}
