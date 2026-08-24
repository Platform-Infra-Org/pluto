import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MaintenanceGate } from './MaintenanceGate';
import { useMaintenance } from './useMaintenance';
import { useIsAdmin } from './useIsAdmin';

jest.mock('./useMaintenance');
jest.mock('./useIsAdmin');

const mockMaintenance = useMaintenance as jest.MockedFunction<typeof useMaintenance>;
const mockIsAdmin = useIsAdmin as jest.MockedFunction<typeof useIsAdmin>;

function renderGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MaintenanceGate>
        <div>the form</div>
      </MaintenanceGate>
    </MemoryRouter>,
  );
}

describe('MaintenanceGate', () => {
  it('shows the maintenance page: maintenance on, non-admin, on /create', () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(false);
    renderGate('/create');
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.queryByText('the form')).not.toBeInTheDocument();
  });

  it('renders children for an admin even while maintenance is on, on /create', () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(true);
    renderGate('/create');
    expect(screen.getByText('the form')).toBeInTheDocument();
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });

  it('renders children on routes other than the request form, e.g. /requests', () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(false);
    renderGate('/requests');
    expect(screen.getByText('the form')).toBeInTheDocument();
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });

  it('renders children when maintenance is off, on /create', () => {
    mockMaintenance.mockReturnValue(false);
    mockIsAdmin.mockReturnValue(false);
    renderGate('/create');
    expect(screen.getByText('the form')).toBeInTheDocument();
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });

  it('renders children while the maintenance answer is still loading, not a flash of the maintenance page', () => {
    mockMaintenance.mockReturnValue(undefined);
    mockIsAdmin.mockReturnValue(false);
    renderGate('/create');
    expect(screen.getByText('the form')).toBeInTheDocument();
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });
});
