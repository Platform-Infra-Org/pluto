import { useEffect, useState } from 'react';
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
}

/**
 * Scaffolder custom field that renders a DynamicSelect. Referenced from a
 * template with `ui:field: DynamicSelect` and configured via `ui:options`
 * (url or proxyPath, intervalMs, placeholder). Requests go through fetchApi
 * (Backstage user token); `proxyPath` additionally routes through the Backstage
 * proxy so authenticated upstream APIs keep their credentials server-side.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DynamicSelectFieldComponent(props: any) {
  const { formData, onChange, uiSchema, schema } = props;
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

  if (err) {
    return <div style={{ color: 'hsl(var(--sc-destructive))' }}>{err}</div>;
  }
  return (
    <div className="sc">
      {schema?.title && <label className="sc-label">{schema.title}</label>}
      {url ? (
        <DynamicSelect
          url={url}
          intervalMs={opts.intervalMs}
          value={(formData as string) ?? ''}
          onChange={v => onChange(v)}
          placeholder={opts.placeholder ?? schema?.title ?? 'Select…'}
          fetcher={(u, signal) => fetchApi.fetch(u, { signal })}
        />
      ) : (
        <select className="sc-select" disabled>
          <option>Loading…</option>
        </select>
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

/** Registers the DynamicSelect scaffolder field. Add to the app's `features`. */
export const platformScaffolderFieldsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [dynamicSelectFormField],
});
