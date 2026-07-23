import { createRootRoute, createRoute, createRouter, useParams } from '@tanstack/react-router'
import { HomePage } from './app/routes/home'
import { ResourceDetail } from './app/routes/resources/detail'
import { ResourceList } from './app/routes/resources/list'

const rootRoute = createRootRoute()

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

const routeTree = rootRoute.addChildren([homeRoute, resourcesRoute, resourceDetailRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
