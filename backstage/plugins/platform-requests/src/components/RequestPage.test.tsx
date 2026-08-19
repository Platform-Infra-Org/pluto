import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigReader } from '@backstage/config';
import { configApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { TestApiProvider } from '@backstage/test-utils';
import { Request } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';
import { RequestPage } from './RequestPage';

// RequestPage reads its id via useRouteRefParams rather than react-router, so
// the route ref hook is stubbed directly instead of standing up a router.
jest.mock('@backstage/frontend-plugin-api', () => ({
  ...jest.requireActual('@backstage/frontend-plugin-api'),
  useRouteRefParams: () => ({ id: '42' }),
}));

const REQUEST: Request = {
  id: 42,
  kind: 'CREATE',
  resourceType: 'demo-resource',
  resourceName: 'my-resource',
  params: {},
  state: 'SUCCEEDED',
  policy: { mode: 'SINGLE' },
  requester: 'dana',
  approvals: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T01:00:00.000Z',
};

function renderWith(config: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [requestsApiRef, { get: jest.fn().mockResolvedValue(REQUEST) } as never],
          [
            identityApiRef,
            {
              getBackstageIdentity: jest.fn().mockResolvedValue({
                ownershipEntityRefs: [],
                userEntityRef: 'user:default/dana',
              }),
            } as never,
          ],
          [
            catalogApiRef,
            { getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }) } as never,
          ],
          [configApiRef, new ConfigReader(config as never)],
        ]}
      >
        <RequestPage />
      </TestApiProvider>
    </MemoryRouter>,
  );
}

describe('RequestPage — Metrics card', () => {
  it('shows the dashboard, scoped to the request window, once Grafana is configured', async () => {
    renderWith({
      platform: {
        grafana: {
          baseUrl: 'https://grafana.example.com',
          dashboard: { uid: 'abc123', slug: 'platform-overview' },
        },
      },
    });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute('src')).toBe(
      'https://grafana.example.com/d/abc123/platform-overview' +
        '?from=1767225600000&to=1767229200000',
    );
  });

  it('has no Metrics card at all when Grafana is not configured', async () => {
    renderWith({});
    // Something else on the page to prove it finished loading, so the absence
    // of "Metrics" below is a real assertion and not a race with the fetch.
    await waitFor(() => expect(screen.getByText('Details')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
