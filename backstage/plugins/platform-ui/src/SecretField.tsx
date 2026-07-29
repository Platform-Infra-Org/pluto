import { useState } from 'react';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';
import { useTemplateSecrets } from '@backstage/plugin-scaffolder-react';

// Inline SVGs (feather eye / eye-off) with explicit width/height so they render
// regardless of MUI's JSS — a MUI SvgIcon collapses to 0×0 here because the
// scaffolder form's context doesn't inject the .MuiSvgIcon-root sizing class.
const EyeIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Scaffolder `ui:field: PlatformSecret` — like Backstage's built-in
 * `ui:field: Secret` (which the new frontend DOES ship: a masked TextField), but
 * adds a reveal (eye) toggle. Deliberately named PlatformSecret, not Secret, so
 * it doesn't collide with the built-in Secret field (which would otherwise
 * shadow it). Same security model: the typed value goes ONLY into the scaffolder
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
            // Fallback gray in case the token isn't in scope, so it's never invisible.
            color: 'hsl(var(--sc-muted-fg, 215 16% 47%))',
            cursor: 'pointer',
          }}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
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

/** `ui:field: PlatformSecret` — add to the scaffolder fields module's extensions. */
export const secretFormField = FormFieldBlueprint.make({
  name: 'platform-secret',
  params: {
    field: async () =>
      createFormField({
        name: 'PlatformSecret',
        component: SecretFieldComponent,
      }),
  },
});
