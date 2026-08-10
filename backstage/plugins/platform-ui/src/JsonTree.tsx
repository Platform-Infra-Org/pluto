import { useMemo, useState } from 'react';
import { parseEmbeddedJson } from './embeddedJson';

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
  /** Render strings that are themselves JSON documents as subtrees. */
  parseEmbedded: boolean;
}

function JsonNode({
  name,
  value,
  depth,
  forceOpen,
  last,
  parseEmbedded,
}: NodeProps) {
  // A string that is itself a JSON document renders as a subtree. useMemo
  // because this runs per leaf per render and a dumped payload can be large;
  // parseEmbeddedJson's prefix check handles the ordinary-string case cheaply.
  const inner = useMemo(
    () =>
      parseEmbedded && typeof value === 'string'
        ? parseEmbeddedJson(value)
        : undefined,
    [parseEmbedded, value],
  );
  const isEmbedded = inner !== undefined;
  const shown = isEmbedded ? inner : value;
  const kind = kindOf(shown);
  const branch = kind === 'object' || kind === 'array';
  // Default: top two levels open, deeper collapsed (large objects stay tidy).
  const [open, setOpen] = useState(forceOpen ?? depth < 2);

  const key = name !== undefined && (
    <span className="sc-json-key">{name}: </span>
  );

  if (!branch) {
    return (
      <div className="sc-json-row">
        {key}
        <span className={`sc-json-${kind}`}>{scalarText(shown)}</span>
        {!last && <span className="sc-json-punc">,</span>}
      </div>
    );
  }

  const entries: [string, Json][] =
    kind === 'array'
      ? (shown as Json[]).map((v, i) => [String(i), v])
      : Object.entries(shown as Record<string, Json>);
  const open0 = kind === 'array' ? '[' : '{';
  const close0 = kind === 'array' ? ']' : '}';
  // The quotes stay on an embedded document: this value IS a string, and what
  // Argo receives depends on that — a string param arrives with its quotes
  // escaped where a real object arrives clean. "{ 3 items }" is honest.
  const openTok = isEmbedded ? `"${open0}` : open0;
  const closeTok = isEmbedded ? `${close0}"` : close0;
  const summary = entries.length === 1 ? '1 item' : `${entries.length} items`;

  return (
    <div className={`sc-json-branch${isEmbedded ? ' sc-json-embedded' : ''}`}>
      <div
        className="sc-json-row sc-json-toggle"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}
      >
        <span className="sc-json-chevron">{open ? '▾' : '▸'}</span>
        {key}
        <span className="sc-json-punc">{openTok}</span>
        {!open && (
          <span className="sc-json-collapsed"> {summary} {closeTok}</span>
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
              parseEmbedded={parseEmbedded}
            />
          ))}
        </div>
      )}
      {open && (
        <div className="sc-json-row">
          <span className="sc-json-punc">{closeTok}</span>
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
  // Default on: a param carrying a dumped payload is the case this viewer
  // struggles with, and the kept quotes mean parsing does not hide that the
  // underlying value is still a string.
  const [parseEmbedded, setParseEmbedded] = useState(true);
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
        <button
          type="button"
          className="sc-btn sc-btn-outline sc-btn-sm"
          aria-pressed={parseEmbedded}
          onClick={() => {
            setParseEmbedded(p => !p);
            setGen(g => g + 1); // remount, so nested defaults re-apply
          }}
        >
          {parseEmbedded ? 'Show raw' : 'Parse JSON'}
        </button>
      </div>
      <div className="sc-json-body" key={gen}>
        <JsonNode
          value={data}
          depth={0}
          forceOpen={forceOpen}
          last
          parseEmbedded={parseEmbedded}
        />
      </div>
    </div>
  );
}
