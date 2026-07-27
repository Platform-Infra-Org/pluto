import { useState } from 'react';

type Json = unknown;

function kindOf(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // string | number | boolean | object
}

function scalarText(v: Json): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

interface NodeProps {
  name?: string;
  value: Json;
  depth: number;
  /** undefined = per-node default; true/false = force expand/collapse (all). */
  forceOpen?: boolean;
  last: boolean;
}

function JsonNode({ name, value, depth, forceOpen, last }: NodeProps) {
  const kind = kindOf(value);
  const branch = kind === 'object' || kind === 'array';
  // Default: top two levels open, deeper collapsed (large objects stay tidy).
  const [open, setOpen] = useState(forceOpen ?? depth < 2);

  const key = name != null && <span className="sc-json-key">{name}: </span>;

  if (!branch) {
    return (
      <div className="sc-json-row">
        {key}
        <span className={`sc-json-${kind}`}>{scalarText(value)}</span>
        {!last && <span className="sc-json-punc">,</span>}
      </div>
    );
  }

  const entries: [string, Json][] =
    kind === 'array'
      ? (value as Json[]).map((v, i) => [String(i), v])
      : Object.entries(value as Record<string, Json>);
  const open0 = kind === 'array' ? '[' : '{';
  const close0 = kind === 'array' ? ']' : '}';
  const summary = entries.length === 1 ? '1 item' : `${entries.length} items`;

  return (
    <div className="sc-json-branch">
      <div
        className="sc-json-row sc-json-toggle"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}
      >
        <span className="sc-json-chevron">{open ? '▾' : '▸'}</span>
        {key}
        <span className="sc-json-punc">{open0}</span>
        {!open && (
          <span className="sc-json-collapsed"> {summary} {close0}</span>
        )}
        {!open && !last && <span className="sc-json-punc">,</span>}
      </div>
      {open && (
        <div className="sc-json-children">
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              name={kind === 'array' ? undefined : k}
              value={v}
              depth={depth + 1}
              forceOpen={forceOpen}
              last={i === entries.length - 1}
            />
          ))}
        </div>
      )}
      {open && (
        <div className="sc-json-row">
          <span className="sc-json-punc">{close0}</span>
          {!last && <span className="sc-json-punc">,</span>}
        </div>
      )}
    </div>
  );
}

/**
 * A stylish, collapsible JSON viewer: objects/arrays are toggleable subtrees
 * (top two levels open by default, deeper collapsed) so large documents stay
 * readable. Expand-all / collapse-all remount the tree with a forced state.
 */
export function JsonTree({ data }: { data: Json }) {
  const [gen, setGen] = useState(0);
  const [forceOpen, setForceOpen] = useState<boolean | undefined>(undefined);
  const set = (open: boolean) => {
    setForceOpen(open);
    setGen(g => g + 1); // remount so every node re-reads the forced state
  };

  return (
    <div className="sc sc-json">
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
      <div className="sc-json-body" key={gen}>
        <JsonNode value={data} depth={0} forceOpen={forceOpen} last />
      </div>
    </div>
  );
}
