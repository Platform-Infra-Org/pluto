import { useState } from 'react';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';
import { useTemplateSecrets } from '@backstage/plugin-scaffolder-react';
import Visibility from '@material-ui/icons/Visibility';
import VisibilityOff from '@material-ui/icons/VisibilityOff';

/**
 * Scaffolder `ui:field: Secret` for the new frontend system, which — unlike the
 * classic system — does not register Backstage's built-in `Secret` field. This
 * is a faithful port of `@backstage/plugin-scaffolder`'s internal `SecretInput`
 * (which isn't publicly exported): the typed value goes ONLY into the scaffolder
 * secrets context via `useTemplateSecrets().setSecrets`, and only a mask of `*`
 * lands in the form data — so the real value never reaches the request params,
 * the task record, Argo, Git, or logs. Reference `${{ secrets.<propertyName> }}`
 * from a `platform:request:submit` step's `secrets[].value`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecretFieldComponent(props: any) {
  const { name, schema, uiSchema, onChange, required } = props;
  const { setSecrets, secrets } = useTemplateSecrets();
  // Secret key = the property name (matches `${{ secrets.<name> }}`); overridable.
  const key = (uiSchema?.['ui:options']?.secretKey as string) || name;
  const [value, setValue] = useState<string>((secrets?.[key] as string) ?? '');
  const [shown, setShown] = useState(false);

  const handle = (v: string) => {
    setValue(v);
    // Only a mask is stored in form data; the value lives solely in the secrets
    // context (exactly what Backstage's built-in SecretInput does).
    onChange(v ? '*'.repeat(v.length) : undefined);
    setSecrets({ [key]: v });
  };

  return (
    <div className="sc">
      {schema?.title && (
        <label className="sc-label">
          {schema.title}
          {required ? ' *' : ''}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="sc-input"
          type={shown ? 'text' : 'password'}
          value={value}
          autoComplete="off"
          placeholder={schema?.title ?? 'Secret'}
          onChange={e => handle(e.target.value)}
        />
        <button
          type="button"
          aria-label={shown ? 'Hide secret' : 'Show secret'}
          title={shown ? 'Hide' : 'Show'}
          onClick={() => setShown(s => !s)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            flex: '0 0 auto',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'hsl(var(--sc-muted-fg))',
            cursor: 'pointer',
          }}
        >
          {shown ? (
            <VisibilityOff fontSize="small" />
          ) : (
            <Visibility fontSize="small" />
          )}
        </button>
      </div>
      {schema?.description && (
        <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {schema.description}
        </div>
      )}
    </div>
  );
}

/** `ui:field: Secret` — add to the scaffolder fields module's extensions. */
export const secretFormField = FormFieldBlueprint.make({
  name: 'secret',
  params: {
    field: async () =>
      createFormField({ name: 'Secret', component: SecretFieldComponent }),
  },
});
