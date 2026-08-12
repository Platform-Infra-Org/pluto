import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { resourceRef } from '@internal/plugin-platform-common';
import { useCatalogNamespace } from './useCatalogNamespace';

/**
 * Shared instance so "nothing to show" is referentially stable — React bails
 * out of a `setState` to the same value, which is what stops the empty and the
 * rejected cases from re-rendering forever.
 */
const EMPTY: ReadonlyMap<string, string> = new Map();

/**
 * The display title for a resource name, or the name itself.
 *
 * The fallback is the **common** case, not an edge case: the workflow writes to
 * Git and the catalog ingests on a poll, so a request that has only just
 * succeeded names a resource the catalog has not read yet. Callers therefore
 * render this immediately and let it upgrade in place when the titles arrive —
 * no spinner, no blank cell, no reflow.
 */
export function titleOf(name: string, titles: ReadonlyMap<string, string>) {
  return titles.get(name) ?? name;
}

/**
 * Catalog titles for a batch of resource names, keyed by name.
 *
 * One `getEntitiesByRefs` per page, never one per row — the whole reason this
 * is a batch hook and not a per-cell one. Names absent from the returned map
 * have no title (or no entity yet); `titleOf` handles both identically.
 *
 * A name is only ever the *text* of a link. Catalog routes address the entity's
 * `name` and titles are neither unique nor routable, so hrefs keep being built
 * from the name via `catalogPath()`.
 */
export function useResourceTitles(
  names: string[],
): ReadonlyMap<string, string> {
  const namespace = useCatalogNamespace();
  // Resource names are turned into refs here and the map is keyed back on the
  // name, so callers keep passing the names they already hold.
  const refs = useMemo(
    () => names.filter(n => n && !n.includes('://')).map(n => resourceRef(namespace, n)),
    [names, namespace],
  );
  const byRef = useEntityTitles(refs);
  return useMemo(() => {
    if (byRef.size === 0) return EMPTY;
    const out = new Map<string, string>();
    for (const n of names) {
      const t = byRef.get(resourceRef(namespace, n));
      if (t) out.set(n, t);
    }
    return out;
  }, [byRef, names, namespace]);
}

/**
 * Catalog titles for a batch of full entity refs, keyed by ref.
 *
 * The kind-agnostic form: a relations graph holds refs of every kind, not
 * resource names. Same contract as above — one call per batch, absent means
 * "no title, use what you had", and a catalog outage degrades to the fallback
 * rather than blanking the graph.
 */
export function useEntityTitles(refs: string[]): ReadonlyMap<string, string> {
  const catalog = useApi(catalogApiRef);
  const [titles, setTitles] = useState(EMPTY);

  // Keyed on the *contents*, not the array identity: call sites build a fresh
  // array literal every render, so an effect depending on the array itself
  // would refetch on every render forever. A newline joins safely — an entity
  // name cannot contain one.
  const key = useMemo(
    () =>
      [...new Set(refs)]
        // A ref with a scheme is an external URL, not a catalog entity; asking
        // the catalog about it would be a guaranteed miss.
        .filter(r => r && !r.includes('://'))
        .sort()
        .join('\n'),
    [refs],
  );

  useEffect(() => {
    if (!key) {
      setTitles(EMPTY);
      return undefined;
    }
    const wanted = key.split('\n');
    let live = true;
    catalog
      .getEntitiesByRefs({
        entityRefs: wanted,
        fields: ['metadata.name', 'metadata.title'],
      })
      .then(({ items }) => {
        if (!live) return;
        const next = new Map<string, string>();
        items.forEach((entity, i) => {
          // A name the catalog has not ingested comes back `undefined` in the
          // array, positionally aligned with the request. Both that and an
          // entity without a title mean "fall back to the name".
          const title = entity?.metadata.title;
          if (title) next.set(wanted[i], title);
        });
        setTitles(next);
      })
      // A catalog outage must degrade to names, never blank the list it is
      // decorating.
      .catch(() => {
        if (live) setTitles(EMPTY);
      });
    return () => {
      live = false;
    };
  }, [catalog, key]);

  return titles;
}
