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
  // The Metrics card is gated on the workflow having shown up, so the default
  // fixture is a request that ran. Tests that want the other side pass an
  // override.
  workflowName: 'git-ops-abc12',
  workflowNamespace: 'argo',
};

function renderWith(
  config: Record<string, unknown>,
  request: Partial<Request> = {},
) {
  const value = { ...REQUEST, ...request };
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [
            requestsApiRef,
            {
              get: jest.fn().mockResolvedValue(value),
              // ExperienceBar and the Workflow card both poll this once the
              // fixture carries a workflowName; unstubbed it throws inside a
              // passive effect and jsdom reports that as an uncaught
              // exception, failing the test though the assertions never ran.
              getWorkflow: jest.fn().mockResolvedValue({ nodes: [] }),
            } as never,
          ],
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

  const GRAFANA = {
    platform: {
      grafana: {
        baseUrl: 'https://grafana.example.com',
        dashboard: { uid: 'abc123', slug: 'platform-overview' },
      },
    },
  };

  it('stays hidden while the state is live but no workflow exists yet', async () => {
    // Submitted, or approved and not yet submitted, but the 5s poll has not
    // seen a workflow: there is no run to plot.
    renderWith(GRAFANA, { state: 'IN_PROGRESS', workflowName: undefined });
    await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
  });

  it('stays hidden before a workflow could exist', async () => {
    renderWith(GRAFANA, { state: 'PENDING_APPROVAL', workflowName: undefined });
    await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
  });

  it('shows for a suspended workflow', async () => {
    // A suspended workflow is a live one, and the old state list dropped the
    // card exactly when someone was looking at a stuck run.
    renderWith(GRAFANA, { state: 'AWAITING_INPUT' });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
  });

  it('shows while running', async () => {
    renderWith(GRAFANA, { state: 'IN_PROGRESS' });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
  });

  it('shows after a failure', async () => {
    renderWith(GRAFANA, { state: 'FAILED' });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
  });

  it('resolves request tokens into the frame src', async () => {
    renderWith({
      platform: {
        grafana: {
          ...GRAFANA.platform.grafana,
          requests: {
            params: {
              'var-wf': '<< workflowName >>',
              'var-req': '<< requestId >>',
              'var-missing': '<< ownerGroup >>',
            },
          },
        },
      },
    });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
    const src = document.querySelector('iframe')!.getAttribute('src')!;
    expect(src).toContain('var-wf=git-ops-abc12');
    expect(src).toContain('var-req=42');
    // ownerGroup is a backend submit token, not one of the six resolved here.
    expect(src).not.toContain('var-missing');
  });

  it('stays hidden when the request dashboard is disabled', async () => {
    renderWith({
      platform: {
        grafana: { ...GRAFANA.platform.grafana, requests: { enabled: false } },
      },
    });
    await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
  });
});
