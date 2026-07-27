import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';

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

// Edit/delete a catalog Resource in place (raises an approval request). Shown
// on Resource entity pages instead of a separate /resources listing.
const resourceActionsCard = EntityCardBlueprint.make({
  name: 'platform-resource-actions',
  params: {
    filter: 'kind:resource',
    type: 'info',
    loader: async () => {
      const { ResourceActionsCard } = await import(
        './components/ResourceActionsCard'
      );
      return <ResourceActionsCard />;
    },
  },
});

// A "Resource Data" tab on Resource pages: renders the full resource JSON as a
// collapsible tree (platform.io/resource-data, or spec.resourceData fallback).
const resourceDataTab = EntityContentBlueprint.make({
  name: 'platform-resource-data',
  params: {
    path: 'data',
    title: 'Resource Data',
    filter: 'kind:resource',
    loader: async () => {
      const { ResourceDataTab } = await import('./components/ResourceDataTab');
      return <ResourceDataTab />;
    },
  },
});

export const platformRelationsCardModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [relationsGraphCard, resourceActionsCard, resourceDataTab],
});
