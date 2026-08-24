import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { useMaintenance, useIsAdmin } from '@internal/plugin-platform-ui';
import { requestsApiRef } from '../api';
import { ResourceActionsCard } from './ResourceActionsCard';

// Real Card/Button/Dialog furniture is kept — only the two maintenance hooks
// are stubbed, the same seam MaintenanceGate.test.tsx uses.
jest.mock('@internal/plugin-platform-ui', () => ({
  ...jest.requireActual('@internal/plugin-platform-ui'),
  useMaintenance: jest.fn(),
  useIsAdmin: jest.fn(),
}));

const mockMaintenance = useMaintenance as jest.MockedFunction<typeof useMaintenance>;
const mockIsAdmin = useIsAdmin as jest.MockedFunction<typeof useIsAdmin>;

const ENTITY: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: { name: 'my-resource' },
  spec: { type: 'demo-resource' },
};

/**
 * Whether the resource page's buttons submit a request, gated on maintenance
 * + admin. The dialog-open flows (Edit/Delete opening the JSON view) are
 * unaffected — only the follow-up submit ("Request update"/"Request delete")
 * is redirected into the maintenance dialog, which is the boundary the
 * backend's 503 actually sits at (POST /requests only).
 */
function renderCard(create: jest.Mock, getResourceData = jest.fn().mockResolvedValue({})) {
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [
            requestsApiRef,
            { create, getResourceData } as never,
          ],
        ]}
      >
        <EntityProvider entity={ENTITY}>
          <ResourceActionsCard />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

describe('ResourceActionsCard — maintenance', () => {
  const create = jest.fn();

  beforeEach(() => {
    create.mockClear();
    create.mockResolvedValue({ id: 7 });
  });

  it('opens a maintenance dialog and submits nothing: maintenance on, non-admin, edit', async () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(false);
    renderCard(create);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByText('This resource has no data to edit.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Request update' }));

    // Same copy MaintenancePage shows, so the two surfaces agree.
    expect(
      screen.getByText(/New requests are paused while the platform is being worked on/),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('opens a maintenance dialog and submits nothing: maintenance on, non-admin, delete', async () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(false);
    renderCard(create);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request delete' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Request delete' }));

    expect(
      screen.getByText(/New requests are paused while the platform is being worked on/),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('submits normally for an admin even while maintenance is on', async () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(true);
    renderCard(create);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request delete' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Request delete' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({
      kind: 'DELETE',
      resourceType: 'demo-resource',
      resourceName: 'my-resource',
      params: {},
    }));
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });

  it('submits normally when maintenance is off', async () => {
    mockMaintenance.mockReturnValue(false);
    mockIsAdmin.mockReturnValue(false);
    renderCard(create);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request delete' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Request delete' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });
});
