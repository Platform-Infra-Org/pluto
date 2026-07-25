import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';
import { DynamicSelect } from './DynamicSelect';

interface UiOptions {
  url?: string;
  intervalMs?: number;
  placeholder?: string;
}

/**
 * Scaffolder custom field that renders a DynamicSelect. Referenced from a
 * template with `ui:field: DynamicSelect` and configured via `ui:options`
 * (url, intervalMs, placeholder). Calls go through Backstage's fetchApi so they
 * carry the user's token.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DynamicSelectFieldComponent(props: any) {
  const { formData, onChange, uiSchema, schema } = props;
  const opts = (uiSchema?.['ui:options'] ?? {}) as UiOptions;
  const fetchApi = useApi(fetchApiRef);

  if (!opts.url) {
    return (
      <div style={{ color: 'hsl(var(--sc-destructive))' }}>
        DynamicSelect: <code>ui:options.url</code> is required.
      </div>
    );
  }
  return (
    <div className="sc">
      {schema?.title && <label className="sc-label">{schema.title}</label>}
      <DynamicSelect
        url={opts.url}
        intervalMs={opts.intervalMs}
        value={(formData as string) ?? ''}
        onChange={v => onChange(v)}
        placeholder={opts.placeholder ?? schema?.title ?? 'Select…'}
        fetcher={(u, signal) => fetchApi.fetch(u, { signal })}
      />
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
