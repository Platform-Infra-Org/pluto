import { useCallback, useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';
import { DynamicSelect } from './DynamicSelect';
import { secretFormField } from './SecretField';
import { pickPath, walkTree } from './coordinateTree';
import { fileFormField } from './FileField';

interface UiOptions {
  /** Direct URL (used as-is; fetchApi still injects the Backstage user token). */
  url?: string;
  /**
   * Path under the Backstage proxy (e.g. `/my-api/regions`). Resolved against
   * the proxy backend, which forwards to the configured upstream and injects
   * that upstream's auth (headers) server-side — so secrets never reach the
   * browser. Prefer this whenever the API requires authentication.
   */
  proxyPath?: string;
  intervalMs?: number;
  placeholder?: string;
  /**
   * Dotted path to the tree inside the response (e.g. `coordinates`), for an
   * endpoint that returns the whole hierarchy rather than one flat level.
   */
  treePath?: string;
  /**
   * Sibling field names whose values are this level's ancestors, outermost
   * first. Explicit rather than inferred from field order: a template may
   * interleave unrelated fields, and an implicit rule would break silently
   * when someone reorders the form.
   */
  dependsOn?: string[];
}

/**
 * One request per URL, shared by every field on the form. Five coordinate
 * levels asking the same endpoint for the same whole tree is five times the
 * work for one answer. Short TTL rather than a context provider: the cache is
 * an implementation detail of this field, and a provider would have to be
 * mounted by every app that uses it.
 */
const TREE_TTL_MS = 30_000;
const treeCache = new Map<string, { at: number; promise: Promise<unknown> }>();

function fetchTree(url: string, fetcher: (u: string) => Promise<Response>) {
  const hit = treeCache.get(url);
  if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.promise;
  const promise = fetcher(url).then(res => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
    return res.json();
  });
  treeCache.set(url, { at: Date.now(), promise });
  return promise;
}

/**
 * Scaffolder custom field that renders a DynamicSelect. Referenced from a
 * template with `ui:field: DynamicSelect` and configured via `ui:options`
 * (url or proxyPath, intervalMs, placeholder). Requests go through fetchApi
 * (Backstage user token); `proxyPath` additionally routes through the Backstage
 * proxy so authenticated upstream APIs keep their credentials server-side.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DynamicSelectFieldComponent(props: any) {
  const { formData, onChange, uiSchema, schema, formContext } = props;
  const opts = (uiSchema?.['ui:options'] ?? {}) as UiOptions;
  const fetchApi = useApi(fetchApiRef);
  const discovery = useApi(discoveryApiRef);

  const [url, setUrl] = useState<string>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (opts.proxyPath) {
          const base = await discovery.getBaseUrl('proxy');
          if (active) setUrl(`${base}${opts.proxyPath}`);
        } else if (opts.url) {
          setUrl(opts.url);
        } else {
          setErr('ui:options requires `url` or `proxyPath`');
        }
      } catch (e) {
        if (active) setErr(String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [opts.url, opts.proxyPath, discovery]);

  const ancestors: string[] = (opts.dependsOn ?? []).map(
    name => (formContext?.formData?.[name] as string) ?? '',
  );
  const [tree, setTree] = useState<unknown>();
  // Distinct from `tree` itself: a tree that resolved to `undefined` (e.g. an
  // empty proxy response) must still count as loaded, or the clearing effect
  // below would never run.
  const [treeLoaded, setTreeLoaded] = useState(false);

  useEffect(() => {
    if (!url || !opts.treePath) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const body = await fetchTree(url, u => fetchApi.fetch(u));
        if (!cancelled) {
          setTree(pickPath(body, opts.treePath));
          setTreeLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setErr(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, opts.treePath, fetchApi]);

  // undefined = an ancestor is unset or stale, which is not the same as an
  // empty branch. The first asks for the parent; the second is a real empty list.
  const levelValues = opts.treePath ? walkTree(tree, ancestors) : undefined;
  const options = levelValues?.map(v => ({ label: v, value: v }));
  const blockedBy = opts.dependsOn?.find((_, i) => !ancestors[i]);

  // A value that survived an ancestor change points at a coordinate that no
  // longer exists; submitting it would name a resource nobody can resolve.
  // Gated on `treeLoaded` (not just `levelValues`) so a value isn't cleared
  // while the tree is still in flight — only once we actually know the
  // answer. Gated on `!blockedBy` so an ancestor the user simply hasn't
  // picked yet doesn't count as "no longer exists".
  useEffect(() => {
    if (!opts.treePath || !formData || blockedBy || !treeLoaded) return;
    if (!levelValues || !levelValues.includes(formData as string)) {
      onChange(undefined);
    }
  }, [levelValues, formData, onChange, opts.treePath, blockedBy, treeLoaded]);

  // One option is not a choice. When a level resolves to exactly one value and
  // the field is still empty, pick it: asking someone to open a dropdown to
  // confirm the only answer is friction, and in a cascade it compounds — a
  // space with one network, one region and one island would be four clicks
  // that could never have gone differently. Auto-filling those lets the reader
  // stop at the first level that actually branches.
  //
  // Only when empty, so this never overrides a deliberate pick, and never
  // fights the clearing effect above: a value it sets is by definition in the
  // list, so nothing clears it back. Once set, formData is non-empty and this
  // cannot fire again for the same level.
  const autoSelect = useCallback(
    (values: string[] | undefined) => {
      if (!values || values.length !== 1 || formData) return;
      onChange(values[0]);
    },
    [formData, onChange],
  );

  useEffect(() => {
    if (!opts.treePath || blockedBy || !treeLoaded) return;
    autoSelect(levelValues);
  }, [levelValues, opts.treePath, blockedBy, treeLoaded, autoSelect]);

  if (err) {
    return <div style={{ color: 'hsl(var(--sc-destructive))' }}>{err}</div>;
  }
  return (
    <div className="sc">
      {schema?.title && <label className="sc-label">{schema.title}</label>}
      {url ? (
        <DynamicSelect
          url={url}
          // In cascade mode this level's options are always resolved here
          // (never undefined, even while blocked or empty) so the child never
          // starts its own fetch against the shared tree URL.
          options={opts.treePath ? options ?? [] : options}
          intervalMs={opts.treePath ? undefined : opts.intervalMs}
          value={(formData as string) ?? ''}
          onChange={v => onChange(v)}
          disabled={Boolean(opts.treePath) && !options}
          // The flat path fetches inside the component, so the only way this
          // field learns what came back is the callback DynamicSelect already
          // exposes for exactly this — "keep a form's default valid".
          onOptions={
            opts.treePath ? undefined : o => autoSelect(o.map(c => c.value))
          }
          placeholder={
            blockedBy
              ? `Pick ${blockedBy} first`
              : opts.placeholder ?? schema?.title ?? 'Select…'
          }
          fetcher={(u, signal) => fetchApi.fetch(u, { signal })}
        />
      ) : (
        // Not a <select>: this is the "resolving the proxy URL" placeholder,
        // shown for an instant before the real (possibly disabled) combobox
        // below replaces it. Sharing role=combobox with that real one would
        // let a role query match this stale placeholder instead.
        <div className="sc-select" aria-disabled="true">
          Loading…
        </div>
      )}
      {schema?.description && (
        <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {schema.description}
        </div>
      )}
    </div>
  );
}

const dynamicSelectFormField = FormFieldBlueprint.make({
  name: 'dynamic-select',
  params: {
    field: async () =>
      createFormField({
        name: 'DynamicSelect',
        component: DynamicSelectFieldComponent,
      }),
  },
});

/** Registers the DynamicSelect + Secret + File scaffolder fields. Add to `features`. */
export const platformScaffolderFieldsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [dynamicSelectFormField, secretFormField, fileFormField],
});
