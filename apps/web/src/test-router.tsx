import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

// Test helper: mount a component that uses <Link> under a minimal memory router
// (plus a QueryClient), so client-side links resolve. `linkPaths` must include
// every route the component links to, e.g. '/resources/$resourceId'.
export function renderWithRouter(ui: ReactNode, linkPaths: string[] = []) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({
    component: () => <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  })
  const paths = Array.from(new Set(['/', ...linkPaths]))
  const routeTree = rootRoute.addChildren(
    paths.map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    ),
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}
