import {
  ApiBlueprint,
  PageBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import AssignmentIcon from '@material-ui/icons/Assignment';
import StorageIcon from '@material-ui/icons/Storage';
import { requestsApiRef, RequestsClient } from './api';
import { rootRouteRef, requestRouteRef, resourcesRouteRef } from './routes';

const requestsApi = ApiBlueprint.make({
  name: 'requests',
  params: defineParams =>
    defineParams({
      api: requestsApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new RequestsClient({ discoveryApi, fetchApi }),
    }),
});

const requestsPage = PageBlueprint.make({
  name: 'requests',
  params: {
    path: '/requests',
    title: 'Requests',
    icon: <AssignmentIcon />,
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/RequestsPage').then(m => <m.RequestsPage />),
  },
});

const requestPage = PageBlueprint.make({
  name: 'request',
  params: {
    path: '/requests/:id',
    routeRef: requestRouteRef,
    loader: () =>
      import('./components/RequestPage').then(m => <m.RequestPage />),
  },
});

const resourcesPage = PageBlueprint.make({
  name: 'resources',
  params: {
    path: '/resources',
    title: 'Resources',
    icon: <StorageIcon />,
    routeRef: resourcesRouteRef,
    loader: () =>
      import('./components/ResourcesPage').then(m => <m.ResourcesPage />),
  },
});

export default createFrontendPlugin({
  pluginId: 'platform-requests',
  extensions: [requestsApi, requestsPage, requestPage, resourcesPage],
  routes: { root: rootRouteRef },
});
