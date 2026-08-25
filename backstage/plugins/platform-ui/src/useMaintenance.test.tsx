import { renderHook, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { useMaintenance } from './useMaintenance';

function apis(fetch: () => Promise<Response>) {
  return [
    [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/platform-requests' }],
    [fetchApiRef, { fetch }],
  ] as const;
}

function renderMaintenance(fetch: () => Promise<Response>) {
  return renderHook(() => useMaintenance(), {
    // eslint-disable-next-line react/no-multi-comp
    wrapper: ({ children }) => (
      <TestApiProvider apis={apis(fetch) as never}>{children}</TestApiProvider>
    ),
  });
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return async () =>
    ({ ok, status, statusText: 'OK', json: async () => body }) as Response;
}

describe('useMaintenance', () => {
  it('is undefined before the first answer', () => {
    const { result } = renderMaintenance(jsonResponse({ enabled: true }));
    expect(result.current).toBeUndefined();
  });

  it('resolves true when the API says so', async () => {
    const { result } = renderMaintenance(jsonResponse({ enabled: true }));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('resolves false when the API says so', async () => {
    const { result } = renderMaintenance(jsonResponse({ enabled: false }));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('resolves false on a rejected fetch (fails open)', async () => {
    const { result } = renderMaintenance(() => Promise.reject(new Error('network down')));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('resolves false on a non-ok response (fails open)', async () => {
    const { result } = renderMaintenance(jsonResponse({}, false, 500));
    await waitFor(() => expect(result.current).toBe(false));
  });
});
