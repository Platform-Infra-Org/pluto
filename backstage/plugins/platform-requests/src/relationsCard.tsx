import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

// Our shadcn React Flow relations graph, registered as an entity card. Replaces
// the default catalog-graph "relations" card (disabled in app-config).
const relationsGraphCard = EntityCardBlueprint.make({
  name: 'platform-relations',
  params: {
    loader: async () => {
      const { RelationsGraph } = await import('./components/RelationsGraph');
      return <RelationsGraph />;
    },
  },
});

export const platformRelationsCardModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [relationsGraphCard],
});
