import { Fragment, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Field,
} from '@internal/plugin-platform-ui';
import { SuspendedNode } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';

/**
 * The approval gate in the middle of a run.
 *
 * The first gate decides whether to start; this one decides whether to
 * continue, with the workflow's own intermediate values in front of the
 * approver — a plan, a diff, a cost estimate. The inputs table is the whole
 * point of the panel: everything else is the button that acts on it.
 */
export function SuspendPanel({
  requestId,
  nodes,
  canResume,
  onResumed,
}: {
  requestId: number;
  nodes: SuspendedNode[];
  canResume: boolean;
  onResumed: () => void;
}) {
  const api = useApi(requestsApiRef);
  const [note, setNote] = useState('');
  const [supplied, setSupplied] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  if (nodes.length === 0) return null;

  const resume = async (node: SuspendedNode) => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const res = await api.resume(requestId, node.id, {
        note: note || undefined,
        parameters: node.suppliedOutputs.length ? supplied : undefined,
      });
      // resumed: false is not an error — somebody else released it, which is
      // the outcome the click was asking for.
      setMessage(res.resumed ? 'Workflow resumed.' : res.reason);
      setNote('');
      setSupplied({});
      onResumed();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Waiting for input" />
      <CardBody>
        {nodes.map(node => (
          <div key={node.id} className="sc-suspend">
            <div className="sc-suspend-step">
              <span className="sc-badge sc-badge-warning">SUSPENDED</span>
              <b>{node.name}</b>
              {node.templateName && (
                <span className="sc-muted"> · {node.templateName}</span>
              )}
            </div>
            {node.message && <p className="sc-suspend-msg">{node.message}</p>}

            {node.inputs.length > 0 && (
              <dl className="sc-kv sc-suspend-inputs">
                {node.inputs.map(i => (
                  <Fragment key={i.name}>
                    <dt>{i.name}</dt>
                    <dd>
                      {i.masked ? (
                        // The key stays visible so the approver knows a value
                        // exists; the value is not sent to the browser at all.
                        <span className="sc-muted" title="Hidden: this value carries a secret">
                          ••••••
                        </span>
                      ) : (
                        <code>{i.value ?? ''}</code>
                      )}
                    </dd>
                  </Fragment>
                ))}
              </dl>
            )}

            {canResume ? (
              <>
                {node.suppliedOutputs.map(name => (
                  <Field key={name} label={name}>
                    <Input
                      value={supplied[name] ?? ''}
                      onChange={e =>
                        setSupplied(s => ({ ...s, [name]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
                <Input
                  placeholder="Note (optional)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <div className="sc-row" style={{ marginTop: 10 }}>
                  <Button disabled={busy} onClick={() => resume(node)}>
                    {busy ? 'Resuming…' : 'Resume workflow'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="sc-muted">
                Only the owning service team or an admin can resume this
                workflow.
              </div>
            )}
          </div>
        ))}
        {message && <div className="sc-notice" style={{ marginTop: 10 }}>{message}</div>}
        {error && (
          <div className="sc-muted" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
