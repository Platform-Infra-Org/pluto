import { fireEvent, render, screen } from '@testing-library/react';
import { JsonEditTree } from './JsonEditTree';
import { leavesOf, pathKey } from './deepEdits';

/** Deep enough that the "top two levels open" default has something to hide. */
const DATA = {
  size: 'large',
  network: { vpc: 'vpc-1', tuning: { mtu: 1500 } },
  empty: {},
};

const setup = (errors: Record<string, string> = {}) => {
  const leaves = leavesOf(DATA);
  const fields = Object.fromEntries(
    leaves.map(l => [pathKey(l.path), l.value]),
  );
  const onChange = jest.fn();
  const r = render(
    <JsonEditTree
      data={DATA}
      leaves={leaves}
      fields={fields}
      errors={errors}
      onChange={onChange}
    />,
  );
  return { ...r, onChange };
};

describe('JsonEditTree', () => {
  it('renders an input for a top-level scalar', () => {
    setup();
    expect(screen.queryByDisplayValue('large')).toBeTruthy();
  });

  it('opens the top two levels and leaves deeper branches collapsed', () => {
    setup();
    // depth 1 is open, so its scalar has an input...
    expect(screen.queryByDisplayValue('vpc-1')).toBeTruthy();
    // ...while `tuning` (depth 2) is collapsed, so its scalar has none yet.
    expect(screen.queryByDisplayValue('1500')).toBeNull();
  });

  it('reveals a deeper field when its branch is expanded', () => {
    const { container } = setup();
    const tuning = [...container.querySelectorAll('.sc-json-toggle')].find(el =>
      el.textContent?.includes('tuning'),
    )!;
    fireEvent.click(tuning);
    expect(screen.queryByDisplayValue('1500')).toBeTruthy();
  });

  it('hides the inputs inside a branch that is collapsed', () => {
    const { container } = setup();
    const network = [...container.querySelectorAll('.sc-json-toggle')].find(
      el => el.textContent?.includes('network'),
    )!;
    fireEvent.click(network);
    expect(screen.queryByDisplayValue('vpc-1')).toBeNull();
  });

  it('reports edits by path key, so a nested field is unambiguous', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByDisplayValue('vpc-1'), {
      target: { value: 'vpc-9' },
    });
    expect(onChange).toHaveBeenCalledWith('["network","vpc"]', 'vpc-9');
  });

  it('shows an empty container as a plain row rather than a dead toggle', () => {
    const { container } = setup();
    const rows = [...container.querySelectorAll('.sc-json-toggle')].map(
      el => el.textContent ?? '',
    );
    expect(rows.some(t => t.includes('empty'))).toBe(false);
    expect(container.textContent).toContain('empty');
  });

  /**
   * The one that matters: an error inside a collapsed branch is an error nobody
   * can see — the dialog refuses to submit and points at nothing.
   */
  it('opens everything when a submit produces an error deep in the tree', () => {
    const { container } = setup({
      '["network","tuning","mtu"]': 'must be a number',
    });
    expect(container.textContent).toContain('must be a number');
    expect(screen.queryByDisplayValue('1500')).toBeTruthy();
  });

  it('collapses everything on demand', () => {
    setup();
    fireEvent.click(screen.getByText('Collapse all'));
    expect(screen.queryByDisplayValue('large')).toBeNull();
  });
});
