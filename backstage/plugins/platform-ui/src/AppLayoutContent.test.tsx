import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { AppLayoutContent } from './AppLayoutContent';
import { useMaintenance } from './useMaintenance';
import { useIsAdmin } from './useIsAdmin';

jest.mock('./useMaintenance');
jest.mock('./useIsAdmin');

const mockMaintenance = useMaintenance as jest.MockedFunction<
  typeof useMaintenance
>;
const mockIsAdmin = useIsAdmin as jest.MockedFunction<typeof useIsAdmin>;

function renderLayout() {
  return renderInTestApp(
    <AppLayoutContent
      nav={<nav>the sidebar</nav>}
      content={<div>the form</div>}
    />,
    { routeEntries: ['/create'] },
  );
}

/**
 * The app/layout override (theme.tsx) has to gate only its `content` input,
 * not the whole shell it hands to SidebarPage. MaintenanceGate.test.tsx
 * renders the gate on its own and cannot catch a regression here — wrapping
 * `nav` in with `content` would still pass every one of those assertions.
 * This renders the actual composition (nav + gated content together) that
 * ships, the way AppRootWrapperBlueprint's `children` did before the fix.
 */
describe('AppLayoutContent', () => {
  it('keeps the nav mounted when maintenance replaces the content', async () => {
    mockMaintenance.mockReturnValue(true);
    mockIsAdmin.mockReturnValue(false);
    await renderLayout();
    expect(screen.getByText('the sidebar')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.queryByText('the form')).not.toBeInTheDocument();
  });

  it('keeps the nav mounted when maintenance is off', async () => {
    mockMaintenance.mockReturnValue(false);
    mockIsAdmin.mockReturnValue(false);
    await renderLayout();
    expect(screen.getByText('the sidebar')).toBeInTheDocument();
    expect(screen.getByText('the form')).toBeInTheDocument();
  });
});
