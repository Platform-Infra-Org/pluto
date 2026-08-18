import { useRef, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';

interface UiOptions {
  /** Forwarded to the input's accept attribute, e.g. `.yaml,.json`. */
  accept?: string;
}

interface Presigned {
  url: string;
  key: string;
  bucket: string;
  expiresIn: number;
}

/**
 * Scaffolder field that puts a local file in S3 and stores its path.
 *
 * The bytes never pass through Backstage: the backend signs a single PUT for
 * exactly this key and exactly this length, and the browser uploads straight
 * to S3. The form value is the s3:// path, which the template forwards to Argo
 * as an ordinary param.
 *
 * A file is not a secret. Anything sensitive belongs in PlatformSecret, which
 * encrypts it and keeps it out of params, logs and Git.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FileFieldComponent(props: any) {
  const { formData, onChange, uiSchema, schema, idSchema } = props;
  const opts = (uiSchema?.['ui:options'] ?? {}) as UiOptions;
  const fetchApi = useApi(fetchApiRef);
  const discovery = useApi(discoveryApiRef);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [name, setName] = useState<string>();
  const aborter = useRef<AbortController>();

  const id = idSchema?.$id ?? 'platform-file';

  const upload = async (file: File) => {
    setBusy(true);
    setErr(undefined);
    setName(file.name);
    aborter.current?.abort();
    aborter.current = new AbortController();
    try {
      const base = await discovery.getBaseUrl('platform-requests');
      const presignRes = await fetchApi.fetch(`${base}/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
        }),
        signal: aborter.current.signal,
      });
      if (!presignRes.ok) {
        throw new Error((await presignRes.text()) || `${presignRes.status}`);
      }
      const signed = (await presignRes.json()) as Presigned;

      // The length is signed server-side (Task 6's presignUpload), not set by
      // us here: Content-Length is a forbidden header per the Fetch spec, so
      // the browser silently drops it and computes the real one from `body`
      // instead. There is no call-site control over it. What still makes the
      // cap real rather than advisory is S3 rejecting a body whose actual
      // length doesn't match the one in the signature.
      const put = await fetch(signed.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        signal: aborter.current.signal,
      });
      if (!put.ok) throw new Error(`${put.status} ${put.statusText}`.trim());

      onChange(`s3://${signed.bucket}/${signed.key}`);
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      setErr(`Upload failed: ${(e as Error)?.message ?? e}`);
      onChange(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sc">
      {schema?.title && (
        <label className="sc-label" htmlFor={id}>
          {schema.title}
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={opts.accept}
        disabled={busy}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {busy && <div className="sc-muted">Uploading {name}…</div>}
      {!busy && formData && (
        <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {name ?? 'Uploaded'} — {String(formData)}{' '}
          <button
            type="button"
            onClick={() => {
              setName(undefined);
              onChange(undefined);
            }}
          >
            Clear
          </button>
        </div>
      )}
      {err && (
        <div style={{ color: 'hsl(var(--sc-destructive))', fontSize: 12 }}>{err}</div>
      )}
      {schema?.description && (
        <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {schema.description}
        </div>
      )}
    </div>
  );
}

export const fileFormField = FormFieldBlueprint.make({
  name: 'platform-file',
  params: {
    field: async () =>
      createFormField({ name: 'PlatformFile', component: FileFieldComponent }),
  },
});
