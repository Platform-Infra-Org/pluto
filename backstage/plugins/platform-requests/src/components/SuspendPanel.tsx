import { Fragment, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  Field,
} from '@internal/plugin-platform-ui';
import { SuspendedNode, SuppliedOutput } from '@internal/plugin-platform-common';
import { requestsApiRef } from '../api';

/** Initial values: whatever the step declared as its defaults. */
function initialAnswers(nodes: SuspendedNode[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of nodes) {
    for (const o of n.suppliedOutputs) {
      if (o.default !== undefined) out[o.name] = o.default;
    }
  }
  return out;
}

/**
 * One question the suspend step is asking.
 *
 * Everything about the field — its label, whether it is required, whether it is
 * a choice, what the choices are, what it means — comes from the step's own
 * parameter declaration. Nothing here is configured in the platform, which is
 * why a new workflow needs no UI change to ask a new question.
 */
function AnswerField({
  spec,
  value,
  onChange,
}: {
  spec: SuppliedOutput;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field
      label={
        <>
          {spec.name}
          {spec.required && <span className="sc-req" title="Required"> *</span>}
        </>
      }
    >
      {spec.enum ? (
        <Select value={value} onChange={e => onChange(e.target.value)}>
          {/* Placeholder only when nothing is chosen yet; a declared default
              means the field is never empty in the first place. */}
          <option value="">— choose —</option>
          {spec.enum.map(v => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : (
        <Input value={value} onChange={e => onChange(e.target.value)} />
      )}
      {spec.description && <p className="sc-help">{spec.description}</p>}
    </Field>
  );
}

/**
 * The approval gate in the middle of a run.
 *
 * The first gate decides whether to start; this one decides whether to
 * continue, with the workflow's own intermediate values in front of the
 * approver — a plan, a diff, a cost estimate. Resume releases the step; Stop
 * refuses it and ends the workflow.
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
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    initialAnswers(nodes),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  if (nodes.length === 0) return null;

  const unanswered = (node: SuspendedNode) =>
    node.suppliedOutputs
      .filter(o => o.required && !(answers[o.name] ?? '').trim())
      .map(o => o.name);

  const run = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      setMessage(await fn());
      setNote('');
      onResumed();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const resume = (node: SuspendedNode) =>
    run(async () => {
      const res = await api.resume(requestId, node.id, {
        note: note || undefined,
        parameters: node.suppliedOutputs.length ? answers : undefined,
      });
      // resumed: false is not an error — somebody else released it, which is
      // the outcome the click was asking for.
      return res.resumed ? 'Workflow resumed.' : res.reason;
    });

  const stop = () =>
    run(async () => {
      await api.stop(requestId, note || undefined);
      return 'Workflow stopped.';
    });

  return (
    <Card>
      <CardHeader title="Waiting for input" />
      <CardBody>
        {nodes.map(node => {
          const missing = unanswered(node);
          return (
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
                        <code>{i.value ?? ''}</code>
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              )}

              {canResume ? (
                <>
                  {node.suppliedOutputs.map(spec => (
                    <AnswerField
                      key={spec.name}
                      spec={spec}
                      value={answers[spec.name] ?? ''}
                      onChange={v => setAnswers(a => ({ ...a, [spec.name]: v }))}
                    />
                  ))}
                  <Input
                    placeholder="Note (optional)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                  <div className="sc-row" style={{ marginTop: 10 }}>
                    <Button
                      disabled={busy || missing.length > 0}
                      title={
                        missing.length
                          ? `Answer required: ${missing.join(', ')}`
                          : undefined
                      }
                      onClick={() => resume(node)}
                    >
                      {busy ? 'Working…' : 'Resume workflow'}
                    </Button>
                    {/* Refusing needs no answers — that is the point of it. */}
                    <Button variant="outline" disabled={busy} onClick={stop}>
                      Stop workflow
                    </Button>
                  </div>
                  {missing.length > 0 && (
                    <p className="sc-help">
                      This step requires: {missing.join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <div className="sc-muted">
                  Only the owning service team or an admin can resume or stop
                  this workflow.
                </div>
              )}
            </div>
          );
        })}
        {message && (
          <div className="sc-notice" style={{ marginTop: 10 }}>
            {message}
          </div>
        )}
        {error && (
          <div className="sc-muted" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
