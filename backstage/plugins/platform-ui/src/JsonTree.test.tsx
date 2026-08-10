import { fireEvent, render, screen } from '@testing-library/react';
import { JsonTree } from './JsonTree';

/**
 * A request's params as a template actually produces them: one ordinary string,
 * one that is a serialised JSON document (the `dump` a template does before
 * putting an object into a single param), and one that merely looks numeric.
 */
const DATA = {
  name: 'orders-db',
  'test-data': '{"region":"eu-west-1","tags":{"team":"checkout"}}',
  note: 'not json',
  count: '42',
};

describe('JsonTree', () => {
  it('expands a param that is itself a dumped JSON document', () => {
    const { container } = render(<JsonTree data={DATA} />);
    // These keys are only reachable if the string was parsed into a subtree.
    // `tags` shows as a collapsed branch, since the tree opens the top two
    // levels only — its own children are deliberately not rendered yet.
    expect(container.textContent).toContain('region');
    expect(container.textContent).toContain('tags');
    expect(container.textContent).toContain('1 item');
  });

  it('keeps the quotes, so a string is not shown as a real object', () => {
    // What Argo receives depends on this: a string param arrives with its
    // quotes escaped where a nested object arrives clean.
    const { container } = render(<JsonTree data={DATA} />);
    expect(container.querySelector('.sc-json-embedded')).toBeTruthy();
    expect(container.textContent).toContain('"{');
  });

  it('leaves ordinary strings alone', () => {
    const { container } = render(<JsonTree data={DATA} />);
    expect(container.textContent).toContain('"not json"');
  });

  it('does not turn a numeric-looking string into a number', () => {
    const { container } = render(<JsonTree data={DATA} />);
    // JSON.parse would happily take "42"; rendering it as a number would claim
    // the workflow receives a number when it receives a string.
    expect(container.textContent).toContain('"42"');
  });

  it('shows the raw string when toggled off, and back again', () => {
    const { container } = render(<JsonTree data={DATA} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show raw' }));
    expect(container.querySelector('.sc-json-embedded')).toBeNull();
    // scalarText wraps in quotes without escaping the inner ones, so raw mode
    // is the original one-liner verbatim.
    expect(container.textContent).toContain('{"region":"eu-west-1"');

    fireEvent.click(screen.getByRole('button', { name: 'Parse JSON' }));
    expect(container.querySelector('.sc-json-embedded')).toBeTruthy();
  });

  it('hides the toggle when no param is a dumped document', () => {
    // Real nested objects are not embedded JSON. This is what almost every
    // request looks like, and a toggle that changed nothing read as broken.
    const plain = {
      size: 'small',
      versioning: true,
      tags: ['prod', 'eu'],
      lifecycle: { expireAfterDays: 90 },
    };
    render(<JsonTree data={plain} />);
    expect(screen.queryByRole('button', { name: 'Show raw' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeTruthy();
  });
});
