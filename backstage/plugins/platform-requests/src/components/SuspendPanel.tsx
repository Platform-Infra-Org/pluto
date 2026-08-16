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
import {
  SuspendedNode,
  SuppliedOutput,
  mayResumeNode,
} from '@internal/plugin-platform-common';
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
 * Whose gate this is, said out loud.
 *
 * Three states, and they are not interchangeable — `mayResumeNode` branches on
 * exactly the same distinction, so this reads it the same way: presence, never
 * truthiness. An absent annotation means the request's own team answers the
 * step as it always has; a named group answers it *instead*; an empty
 * annotation is a broken one and falls to admins. Collapsing the last two would
 * turn a deliberate fail-closed stall into a silently wider gate, and turn the
 * stall itself into a mystery for whoever is waiting on it.
 */
function gateOwnerOf(
  approverGroup: string | undefined,
  ownerGroup: string | undefined,
): string {
  if (approverGroup === undefined) {
    return ownerGroup
      ? `Answered by ${ownerGroup}, the owning team`
      : 'Answered by admins — this request names no owning team';
  }
  return approverGroup.trim() === ''
    ? 'Approver group unresolved — this step names a team that could not be resolved, so only an admin can answer it'
    : `Answered by ${approverGroup.trim()}`;
}

/**
 * The approval gate in the middle of a run.
 *
 * The first gate decides whether to start; this one decides whether to
 * continue, with the workflow's own intermediate values in front of the
 * approver — a plan, a diff, a cost estimate. Resume releases the step; Stop
 * refuses it and ends the workflow.
 *
 * Authorisation is decided **per node**: one request can wait on a cost gate
 * owned by finance and a schema gate owned by DBAs at the same moment, and the
 * viewer may answer neither, one, or both. A gate the viewer cannot answer is
 * still rendered in full — that is how they learn whom to chase. The verdict
 * and its wording come from `mayResumeNode`, the same function the resume route
 * enforces, so the button and the 403 can never disagree.
 *
 * Refusing a gate lives here, beside the step it refuses, and asks that step's
 * own question: whoever may release it may refuse it, so a team locked out of a
 * gate is locked out of refusing it too. It takes no confirmation — the team
 * clicking it is the team that was asked.
 *
 * Abandoning the whole request is a different question and lives elsewhere, in
 * StopWorkflowButton beside the workflow graph, where it is offered for as long
 * as the run lasts rather than only while a step happens to be waiting.
 */
export function SuspendPanel({
  requestId,
  nodes,
  isAdmin,
  groups,
  ownerGroup,
  onResumed,
}: {
  requestId: number;
  nodes: SuspendedNode[];
  /** Viewer is in one of `platform.rbac.adminGroups`. */
  isAdmin: boolean;
  /** The viewer's own group entityRefs. */
  groups: string[];
  /** The request's owning service team, if it has one. */
  ownerGroup?: string;
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

  const stop = (nodeId?: string) =>
    run(async () => {
      const res = await api.stop(requestId, note || undefined, nodeId);
      // stopped: false is not an error — the step went away under us, which is
      // the outcome the click was asking for.
      return res.stopped === false && res.reason
        ? res.reason
        : 'Workflow stopped.';
    });

  return (
    <Card>
      <CardHeader title="Waiting for input" />
      <CardBody>
        {nodes.map(node => {
          const missing = unanswered(node);
          const gate = mayResumeNode({
            isAdmin,
            groups,
            ownerGroup,
            approverGroup: node.approverGroup,
          });
          return (
            <div key={node.id} className="sc-suspend">
              <div className="sc-suspend-step">
                <span className="sc-badge sc-badge-warning">SUSPENDED</span>
                <b>{node.name}</b>
                {node.templateName && (
                  <span className="sc-muted"> · {node.templateName}</span>
                )}
              </div>
              <p className="sc-muted">
                {gateOwnerOf(node.approverGroup, ownerGroup)}
              </p>
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

              {gate.allowed ? (
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
                    {/* Refusing this gate. No answers needed — that is what
                        refusing means — and it takes no confirmation, because
                        the team being asked to approve is the one clicking it
                        and the question was already put to them. */}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => stop(node.id)}
                    >
                      Refuse and stop
                    </Button>
                  </div>
                  {missing.length > 0 && (
                    <p className="sc-help">
                      This step requires: {missing.join(', ')}
                    </p>
                  )}
                </>
              ) : (
                // The step stays on screen and so does its control, disabled.
                // A missing button reads as "nothing to do here"; a dead one
                // beside a reason reads as "not yours", and names who to ask.
                // Asking is the point — the answers are not shown, because
                // filling them in would only earn a 403.
                <div className="sc-row" style={{ marginTop: 10 }}>
                  <Button disabled title={gate.reason}>
                    Resume workflow
                  </Button>
                  <span className="sc-muted">{gate.reason}.</span>
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
