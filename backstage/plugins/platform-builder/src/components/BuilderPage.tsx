import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Field,
  Input,
  Select,
} from '@internal/plugin-platform-ui';
import { builderApiRef, PublishResult, RequestField } from '../api';

const TYPES = ['string', 'number', 'boolean', 'enum'] as const;

export function BuilderPage() {
  const api = useApi(builderApiRef);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<RequestField[]>([
    { name: 'region', title: 'Region', type: 'string', required: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult>();
  const [error, setError] = useState<string>();

  const setField = (i: number, patch: Partial<RequestField>) =>
    setFields(fs => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const res = await api.createDefinition({
        name: name.trim(),
        title: title.trim() || name.trim(),
        fields: fields
          .filter(f => f.name.trim())
          .map(f => ({ ...f, enum: f.type === 'enum' ? f.enum : undefined })),
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Service Builder"
        subtitle="Author a resource type — publishes a software template + Argo workflow"
      />
      <div className="sc-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card>
          <CardHeader title="New resource type" />
          <CardBody>
            <div
              className="sc-grid"
              style={{ gridTemplateColumns: '1fr 1fr' }}
            >
              <Field label="Type id (e.g. cache)">
                <Input value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label="Title">
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </Field>
            </div>

            <div className="sc-label" style={{ marginTop: 8 }}>
              Request fields
            </div>
            {fields.map((f, i) => (
              <div
                key={i}
                className="sc-row"
                style={{ marginBottom: 8, alignItems: 'flex-end' }}
              >
                <div style={{ flex: 2 }}>
                  <Input
                    placeholder="name"
                    value={f.name}
                    onChange={e => setField(i, { name: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Select
                    value={f.type}
                    onChange={e =>
                      setField(i, {
                        type: e.target.value as RequestField['type'],
                      })
                    }
                  >
                    {TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div style={{ flex: 2 }}>
                  {f.type === 'enum' && (
                    <Input
                      placeholder="values (csv)"
                      value={(f.enum ?? []).join(',')}
                      onChange={e =>
                        setField(i, {
                          enum: e.target.value
                            .split(',')
                            .map(s => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFields(fs => fs.filter((_, j) => j !== i))
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFields(fs => [...fs, { name: '', type: 'string' }])}
            >
              + Add field
            </Button>

            <div style={{ marginTop: 18 }}>
              <Button disabled={busy || !name.trim()} onClick={submit}>
                Publish type
              </Button>
            </div>
            {error && (
              <div style={{ color: 'hsl(var(--sc-destructive))', marginTop: 12 }}>
                {error}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Result" />
          <CardBody>
            {!result && !error && (
              <div className="sc-muted">
                Publishing generates a Scaffolder template + an Argo
                WorkflowTemplate and makes the type requestable.
              </div>
            )}
            {result && (
              <>
                <div>
                  Published <b>{result.name}</b> — now requestable.
                </div>
                <div className="sc-muted" style={{ marginTop: 8 }}>
                  Template: <code>{result.templatePath}</code>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Link to="/create" className="sc-link">
                    Go to Create →
                  </Link>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
