import { createRootRoute, createRoute, createRouter, Outlet, useParams } from '@tanstack/react-router'
import { HomePage } from './app/routes/home'
import { ResourceDetail } from './app/routes/resources/detail'
import { ResourceList } from './app/routes/resources/list'
import { MyRequests } from './app/routes/requests/mine'
import { NewRequest } from './app/routes/requests/new'
import { ApprovalQueue } from './app/routes/requests/queue'
import { RequestDetail } from './app/routes/requests/detail'
import { NotificationsPage } from './app/notifications/page'
import { BuilderCanvas } from './app/builder/canvas'
import { GraphEditor } from './app/builder/graph/editor'
import { MyDefinitions } from './app/services/mine'
import { OnboardingQueue } from './app/services/onboarding-queue'
import { AdminDashboard } from './app/admin/shell'
import { BlockOnboard } from './app/blocks/onboard'
import { AuthCallback } from './app/routes/auth-callback'
import { NavBar } from './app/nav'

// Root layout: the persistent role-aware nav shell over every route.
function RootLayout() {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  )
}

const rootRoute = createRootRoute({ component: RootLayout })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const resourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/resources',
  component: ResourceList,
})

function ResourceDetailPage() {
  const { resourceId } = useParams({ from: '/resources/$resourceId' })
  return <ResourceDetail id={Number(resourceId)} />
}

const resourceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/resources/$resourceId',
  component: ResourceDetailPage,
})

const myRequestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests',
  component: MyRequests,
})

const approvalQueueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/queue',
  component: ApprovalQueue,
})

function NewRequestPage() {
  const { type, action, resourceId } = newRequestRoute.useSearch()
  return (
    <NewRequest
      resourceType={type}
      action={action}
      resourceId={resourceId > 0 ? resourceId : null}
    />
  )
}

type NewRequestSearch = { type: string; action: 'CREATE' | 'UPDATE' | 'DELETE'; resourceId: number }

const newRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/new',
  validateSearch: (s: Record<string, unknown>): NewRequestSearch => {
    const action = s.action === 'UPDATE' || s.action === 'DELETE' ? s.action : 'CREATE'
    return { type: String(s.type ?? ''), action, resourceId: Number(s.resourceId ?? 0) || 0 }
  },
  component: NewRequestPage,
})

function RequestDetailPage() {
  const { requestId } = useParams({ from: '/requests/$requestId' })
  return <RequestDetail id={Number(requestId)} />
}

const requestDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/$requestId',
  component: RequestDetailPage,
})

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: NotificationsPage,
})

const builderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/builder',
  component: BuilderCanvas,
})

// CB03 graph editor — a sub-route so the E08 form builder (/builder) stays reachable.
const graphEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/builder/graph',
  component: GraphEditor,
})

const myDefinitionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services',
  component: MyDefinitions,
})

const onboardingQueueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services/onboarding',
  component: OnboardingQueue,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminDashboard,
})

const blocksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blocks',
  component: BlockOnboard,
})

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallback,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  resourcesRoute,
  resourceDetailRoute,
  myRequestsRoute,
  newRequestRoute,
  approvalQueueRoute,
  requestDetailRoute,
  notificationsRoute,
  builderRoute,
  graphEditorRoute,
  myDefinitionsRoute,
  onboardingQueueRoute,
  adminRoute,
  blocksRoute,
  authCallbackRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
