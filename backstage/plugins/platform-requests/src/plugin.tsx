import {
  ApiBlueprint,
  PageBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import AssignmentIcon from '@material-ui/icons/Assignment';
import { requestsApiRef, RequestsClient } from './api';
import { rootRouteRef, requestRouteRef } from './routes';

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

export default createFrontendPlugin({
  pluginId: 'platform-requests',
  extensions: [requestsApi, requestsPage, requestPage],
  routes: { root: rootRouteRef },
});
