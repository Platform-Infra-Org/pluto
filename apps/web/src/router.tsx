import { createRootRoute, createRoute, createRouter, Outlet, useParams } from '@tanstack/react-router'
import { HomePage } from './app/routes/home'
import { ResourceDetail } from './app/routes/resources/detail'
import { ResourceList } from './app/routes/resources/list'
import { MyRequests } from './app/routes/requests/mine'
import { NewRequest } from './app/routes/requests/new'
import { ApprovalQueue } from './app/routes/requests/queue'
import { RequestDetail } from './app/routes/requests/detail'
import { NotificationBell } from './app/notifications/bell'
import { NotificationsPage } from './app/notifications/page'

// Root layout: a thin top bar holding the live notification bell, over the routes.
function RootLayout() {
  return (
    <>
      <header className="flex items-center justify-end border-b px-4 py-2">
        <NotificationBell />
      </header>
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
  const { type } = newRequestRoute.useSearch()
  return <NewRequest resourceType={type} />
}

const newRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/new',
  validateSearch: (s: Record<string, unknown>): { type: string } => ({
    type: String(s.type ?? ''),
  }),
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

const routeTree = rootRoute.addChildren([
  homeRoute,
  resourcesRoute,
  resourceDetailRoute,
  myRequestsRoute,
  newRequestRoute,
  approvalQueueRoute,
  requestDetailRoute,
  notificationsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
