import { ReactNode } from 'react';
import { SidebarPage } from '@backstage/core-components';
import { MaintenanceGate } from './MaintenanceGate';

/**
 * The app shell: nav plus content, content alone gated by maintenance mode.
 *
 * This is what `theme.tsx`'s `app/layout` override renders in place of the
 * built-in one — extracted to its own component so the composition itself
 * (nav survives when the gate swaps in the maintenance page) is unit
 * testable without reaching into Backstage's opaque extension internals. See
 * `theme.tsx` for why `app/layout` is overridden at all rather than wrapping
 * `app/root`'s `children` with AppRootWrapperBlueprint.
 */
export function AppLayoutContent({
  nav,
  content,
}: {
  nav: ReactNode;
  content: ReactNode;
}) {
  return (
    <SidebarPage>
      {nav}
      <MaintenanceGate>{content}</MaintenanceGate>
    </SidebarPage>
  );
}
