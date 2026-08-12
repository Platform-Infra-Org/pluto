import { useEffect, useRef, useState } from 'react';
import { Field, Input } from './components';
import { Leaf, pathKey } from './deepEdits';

/**
 * The read-only JSON viewer's shape, with an input at every leaf.
 *
 * Deliberately the same furniture as `JsonTree` — the same chevrons, the same
 * `sc-json-*` classes, the same "top two levels open" default — because the
 * edit dialog and the resource-data tab show the same document, and a person
 * moving between them should not have to re-learn where anything is.
 *
 * Containers are structure, not values: they toggle, they never edit. Adding or
 * removing keys is out of scope on purpose — the document's shape is the
 * workflow's contract.
 */

type Json = unknown;

const isBranch = (v: Json): boolean => v !== null && typeof v === 'object';

interface NodeProps {
  name?: string;
  value: Json;
  path: Array<string | number>;
  depth: number;
  /** undefined = per-node default; true/false = force expand/collapse (all). */
  forceOpen?: boolean;
  leaves: Map<string, Leaf>;
  fields: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function EditNode({
  name,
  value,
  path,
  depth,
  forceOpen,
  leaves,
  fields,
  errors,
  onChange,
}: NodeProps) {
  // Same default as the viewer: the top two levels open, deeper collapsed, so a
  // large document opens tidy rather than as a wall of inputs.
  const [open, setOpen] = useState(forceOpen ?? depth < 2);

  if (!isBranch(value)) {
    const key = pathKey(path);
    const leaf = leaves.get(key);
    return (
      <div className="sc-json-row">
        <Field
          label={
            <>
              {name ?? ''}
              {leaf && leaf.type !== 'string' && (
                <span className="sc-muted"> ({leaf.type})</span>
              )}
            </>
          }
        >
          <Input
            value={fields[key] ?? ''}
            onChange={e => onChange(key, e.target.value)}
          />
          {errors[key] && (
            <div
              role="alert"
              style={{
                color: 'hsl(var(--sc-destructive))',
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {errors[key]}
            </div>
          )}
        </Field>
      </div>
    );
  }

  const array = Array.isArray(value);
  const entries: Array<[string, Json]> = array
    ? (value as Json[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, Json>);
  const openTok = array ? '[' : '{';
  const closeTok = array ? ']' : '}';

  // An empty container has nothing to toggle and no fields inside it. Showing
  // it as a dead chevron reads as broken, so it renders as a plain row that
  // says what it is — the key exists, it just holds nothing.
  if (entries.length === 0) {
    return (
      <div className="sc-json-row">
        {name !== undefined && <span className="sc-json-key">{name}: </span>}
        <span className="sc-json-punc">
          {openTok}
          {closeTok}
        </span>
      </div>
    );
  }

  const summary = entries.length === 1 ? '1 field' : `${entries.length} fields`;

  return (
    <div className="sc-json-branch">
      <div
        className="sc-json-row sc-json-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}
      >
        <span className="sc-json-chevron">{open ? '▾' : '▸'}</span>
        {name !== undefined && <span className="sc-json-key">{name}: </span>}
        <span className="sc-json-punc">{openTok}</span>
        {!open && (
          <span className="sc-json-collapsed">
            {' '}
            {summary} {closeTok}
          </span>
        )}
      </div>
      {open && (
        <div className="sc-json-children">
          {entries.map(([k, v]) => (
            <EditNode
              key={k}
              name={k}
              value={v}
              path={[...path, array ? Number(k) : k]}
              depth={depth + 1}
              forceOpen={forceOpen}
              leaves={leaves}
              fields={fields}
              errors={errors}
              onChange={onChange}
            />
          ))}
        </div>
      )}
      {open && (
        <div className="sc-json-row">
          <span className="sc-json-punc">{closeTok}</span>
        </div>
      )}
    </div>
  );
}

export function JsonEditTree({
  data,
  leaves,
  fields,
  errors,
  onChange,
}: {
  data: Record<string, unknown>;
  leaves: Leaf[];
  fields: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [gen, setGen] = useState(0);
  const [forceOpen, setForceOpen] = useState<boolean | undefined>(undefined);
  const set = (o: boolean) => {
    setForceOpen(o);
    setGen(g => g + 1); // remount so every node re-reads the forced state
  };

  // A validation error inside a collapsed branch is an error nobody can see:
  // the dialog refuses to submit and points at nothing. So the first time a
  // submit produces errors, everything opens.
  const sig = Object.keys(errors).sort().join('|');
  // Seeded empty, not with `sig`: errors are normally absent on the first
  // render and appear on submit, but a dialog that mounts with errors already
  // set would otherwise keep them hidden — the one case where hiding them is
  // least excusable.
  const prev = useRef('');
  useEffect(() => {
    if (sig && sig !== prev.current) set(true);
    prev.current = sig;
  }, [sig]);

  const byKey = new Map(leaves.map(l => [pathKey(l.path), l]));

  return (
    <div className="sc-json">
      <div className="sc-json-bar">
        <button
          type="button"
          className="sc-btn sc-btn-outline sc-btn-sm"
          onClick={() => set(true)}
        >
          Expand all
        </button>
        <button
          type="button"
          className="sc-btn sc-btn-outline sc-btn-sm"
          onClick={() => set(false)}
        >
          Collapse all
        </button>
      </div>
      <div key={gen}>
        <EditNode
          value={data}
          path={[]}
          depth={0}
          forceOpen={forceOpen}
          leaves={byKey}
          fields={fields}
          errors={errors}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
