import { platformLight } from './theme';

/**
 * The scaffolder form's fields are MUI v4 components, and their label geometry
 * is set through the theme's published override keys. Nothing rendered this
 * file before: a selector that never matches produces no error, no failing
 * test, and a label sitting outside the notch cut for it.
 */
describe('input label geometry', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overrides = (platformLight.getTheme('v4') as any).overrides;
  const label = overrides.MuiInputLabel;
  const outline = overrides.MuiOutlinedInput;

  it('insets only the standard variant on the create route', () => {
    // The boxed field this 10px aligns with (styles.ts, padding 3px
    // var(--sc-field-x)) is standard-variant and exists on that route alone.
    const keys = Object.keys(label.formControl);
    expect(keys).toHaveLength(1);
    const selector = keys[0];
    expect(selector).toContain('.sc-route-create');
    expect(label.formControl[selector].left).toBe('var(--sc-field-x)');
  });

  it('excludes outlined and filled labels from that inset', () => {
    // This selector is (0,2,0) and the outlined reset is (0,1,0), so without
    // the :not() pair the inset wins and an outlined label — every entity
    // picker — lands 10px right of its notch. Substring matching because MUI
    // v4 suffixes its class names.
    const selector = Object.keys(label.formControl)[0];
    expect(selector).toContain(':not([class*="MuiInputLabel-outlined"])');
    expect(selector).toContain(':not([class*="MuiInputLabel-filled"])');
  });

  it('keeps the outlined reset and its 2px-border clearance', () => {
    expect(label.outlined.left).toBe('0');
    // MUI's -6px assumes a 1px border; ours is 2px.
    expect(label.outlined['&.MuiInputLabel-shrink'].transform).toBe(
      'translate(14px, -7px) scale(0.75)',
    );
    // The shrink slot's 4px would widen the label past the notch.
    expect(label.outlined['&.MuiInputLabel-shrink'].paddingInlineEnd).toBe('0');
  });

  it('measures the notch with the same metrics the label paints', () => {
    // MUI sizes the notch from the legend's own rendered text (width:auto,
    // fontSize .75em). Every property styles.ts forces on the label must be
    // mirrored here or the notch is cut for a different string, and the error
    // grows with the title's length.
    expect(outline.notchedOutline['& legend']).toEqual({
      textTransform: 'uppercase',
      fontFamily: 'var(--sc-font-ui)',
      letterSpacing: 0,
      fontWeight: 400,
    });
  });
});
