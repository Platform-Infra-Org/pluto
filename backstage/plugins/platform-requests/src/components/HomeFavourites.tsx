import { useEffect, useState } from 'react';
import { Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  useStarredEntities,
} from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { Card, EmptyState, LAUREL } from '@internal/plugin-platform-ui';
import { useCatalogNamespace } from '../useCatalogNamespace';

interface Favourite {
  ref: string;
  name: string;
  title: string;
  namespace: string;
}

/**
 * Templates the user has starred.
 *
 * Nothing here stores anything: the star already sits on every template card
 * at /create and writes through starredEntitiesApi, which is the same
 * per-user store the rest of this page reads. Only the reading was missing.
 */
export function FavouriteTemplates({ max }: { max: number }) {
  const catalog = useApi(catalogApiRef);
  const defaultNamespace = useCatalogNamespace();
  const { starredEntities } = useStarredEntities();
  const [rows, setRows] = useState<Favourite[]>();

  useEffect(() => {
    const refs = [...starredEntities].filter(r =>
      r.toLowerCase().startsWith('template:'),
    );
    if (refs.length === 0) {
      setRows([]);
      return;
    }
    catalog
      .getEntitiesByRefs({
        entityRefs: refs,
        fields: ['kind', 'metadata.name', 'metadata.namespace', 'metadata.title'],
      })
      .then(({ items }) => {
        setRows(
          items.flatMap((e, i) => {
            // A starred template that has since been deleted comes back
            // undefined. Dropping it beats rendering a link to nothing.
            if (!e) return [];
            const { name, namespace } = parseEntityRef(refs[i]);
            return [
              {
                ref: refs[i],
                name: e.metadata.name ?? name,
                title: e.metadata.title ?? e.metadata.name ?? name,
                // The entity's own namespace first; the configured one only
                // when metadata omits it, so a deployment that moved off
                // `default` does not still get `default` here.
                namespace: e.metadata.namespace ?? namespace ?? defaultNamespace,
              },
            ];
          }),
        );
      })
      .catch(() => setRows([]));
  }, [catalog, starredEntities, defaultNamespace]);

  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Favourite templates</div>
      </div>
      {!rows && <div className="sc-card-b sc-muted">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="sc-card-b">
          {/* This is the one card that has to teach its own feature: nobody
              has starred anything until they know the star is there. */}
          <EmptyState
            sprite={LAUREL}
            title="No favourites"
            hint="Star a template on the Create page and it appears here."
          />
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="sc-card-b sc-grid" style={{ gap: 8 }}>
          {rows.slice(0, max).map(f => (
            <Link
              key={f.ref}
              to={`/create/templates/${f.namespace}/${f.name}`}
              className="sc-action"
            >
              <span className="sc-action-l">{f.title}</span>
              <span className="sc-action-h sc-muted">{f.name}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
