import {
  ApiBlueprint,
  PageBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import BuildIcon from '@material-ui/icons/Build';
import { builderApiRef, BuilderClient } from './api';
import { rootRouteRef } from './routes';

const builderApi = ApiBlueprint.make({
  name: 'builder',
  params: defineParams =>
    defineParams({
      api: builderApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new BuilderClient({ discoveryApi, fetchApi }),
    }),
});

const builderPage = PageBlueprint.make({
  name: 'builder',
  params: {
    path: '/service-builder',
    title: 'Service Builder',
    icon: <BuildIcon />,
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/BuilderPage').then(m => <m.BuilderPage />),
  },
});

export default createFrontendPlugin({
  pluginId: 'platform-builder',
  extensions: [builderApi, builderPage],
  routes: { root: rootRouteRef },
});
