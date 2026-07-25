// Read-only form rendering of a resource's JSON: objects become labeled
// subsections, arrays become lists, scalars become label→value rows.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function FieldValue({ value }: { value: unknown }) {
  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return <span className="text-muted-foreground">—</span>
    return (
      <div className="space-y-2 border-l border-border pl-3">
        {entries.map(([k, v]) => (
          <Field key={k} label={k} value={v} />
        ))}
      </div>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">—</span>
    return (
      <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
        {value.map((v, i) => (
          <li key={i}>
            <FieldValue value={v} />
          </li>
        ))}
      </ul>
    )
  }
  return <span className="font-mono text-sm break-all">{String(value)}</span>
}

function Field({ label, value }: { label: string; value: unknown }) {
  const nested = isRecord(value) || Array.isArray(value)
  return (
    <div className={nested ? 'space-y-1' : 'flex flex-wrap items-baseline gap-2'}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <FieldValue value={value} />
    </div>
  )
}

export function ResourceForm({ value }: { value: unknown }) {
  return (
    <div className="space-y-3">
      <FieldValue value={value} />
    </div>
  )
}
