import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { configApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { TestApiProvider, mockApis } from '@backstage/test-utils';
import { titleOf, useResourceTitles } from './useResourceTitles';

/** Entities in catalog order; `undefined` is how a miss comes back. */
const entities = (...titles: (string | undefined)[]) => ({
  items: titles.map(title =>
    title === undefined ? undefined : { metadata: { title } },
  ),
});

const render = (names: string[], getEntitiesByRefs: jest.Mock, data = {}) => {
  const catalog = { getEntitiesByRefs } as any;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestApiProvider
      apis={[
        [catalogApiRef, catalog],
        [configApiRef, mockApis.config({ data })],
      ]}
    >
      {children}
    </TestApiProvider>
  );
  return renderHook(({ n }: { n: string[] }) => useResourceTitles(n), {
    wrapper,
    initialProps: { n: names },
  });
};

describe('titleOf', () => {
  it('prefers the title and falls back to the name', () => {
    const titles = new Map([['a', 'Alpha']]);
    expect(titleOf('a', titles)).toBe('Alpha');
    expect(titleOf('b', titles)).toBe('b');
  });
});

describe('useResourceTitles', () => {
  it('maps names to titles when the catalog knows them', async () => {
    // Both assertions live inside the waitFor, and the timeout is explicit.
    //
    // This is the only case in the file that asserts an *upgraded* value; the
    // others assert the fallback, which reads the same before and after the
    // state lands and so cannot be raced. That is why this one alone used to
    // fail, roughly once in ten full-suite runs and never when the file ran on
    // its own: the hook resolves a promise and commits in a `then`, and
    // waitFor's default 1s budget is not guaranteed on a worker competing with
    // six others. Waiting on the rendered result rather than on the call, and
    // giving it room, is what makes it deterministic — the assertion is
    // retried as a unit instead of one value being checked after the other.
    const get = jest.fn().mockResolvedValue(entities('Alpha', 'Beta'));
    const { result } = render(['a', 'b'], get);
    await waitFor(
      () => {
        expect(result.current.get('a')).toBe('Alpha');
        expect(result.current.get('b')).toBe('Beta');
      },
      { timeout: 10_000 },
    );
  });

  // The three below wait on the call rather than on the result, which is only
  // safe because each asserts the *fallback*: titleOf returns the name whether
  // or not the map has landed, so there is no window in which they could read
  // a different answer. Anything asserting an upgraded value must wait on the
  // value, as the case above does.
  it('leaves a name unmapped when the entity is missing or has no title', async () => {
    // 'a' has not been ingested yet; 'b' exists but carries no title.
    const get = jest
      .fn()
      .mockResolvedValue({ items: [undefined, { metadata: {} }] });
    const { result } = render(['a', 'b'], get);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(titleOf('a', result.current)).toBe('a');
    expect(titleOf('b', result.current)).toBe('b');
  });

  it('degrades to names when the catalog call rejects', async () => {
    const get = jest.fn().mockRejectedValue(new Error('catalog down'));
    const { result } = render(['a', 'b'], get);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(titleOf('a', result.current)).toBe('a');
    expect(titleOf('b', result.current)).toBe('b');
  });

  it('makes one batched call for many names, skipping URLs', async () => {
    const get = jest.fn().mockResolvedValue(entities('Alpha', 'Beta'));
    render(['b', 'a', 'a', 'https://example.test/x'], get);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith({
      entityRefs: ['resource:default/a', 'resource:default/b'],
      fields: ['metadata.name', 'metadata.title'],
    });
  });

  it('never asks the catalog about an empty list', async () => {
    const get = jest.fn();
    const { result } = render([], get);
    await waitFor(() => expect(result.current.size).toBe(0));
    expect(get).not.toHaveBeenCalled();
  });

  it('uses the configured namespace', async () => {
    const get = jest.fn().mockResolvedValue(entities('Alpha'));
    render(['a'], get, { platform: { catalog: { namespace: 'platform' } } });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0].entityRefs).toEqual(['resource:platform/a']);
  });

  it('does not refetch when a new array holds the same names', async () => {
    const get = jest.fn().mockResolvedValue(entities('Alpha', 'Beta'));
    const { rerender } = render(['a', 'b'], get);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    rerender({ n: ['a', 'b'] });
    rerender({ n: ['b', 'a'] });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
