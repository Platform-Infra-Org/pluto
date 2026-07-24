import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { fetchBlocks, onboardBlockForm, type Block, type BlockFormManifest } from '@/lib/blocks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// One row per registered block: its kind + template ref + typed IO. This is the
// palette CB02/CB03 build on, so surfacing the types here is the whole point.
function BlockRow({ block }: { block: Block }) {
  const m = block.manifest
  const io = (fields: { name: string; type: string; required?: boolean }[]) =>
    fields.map((f) => `${f.name}: ${f.type}${f.required ? '' : '?'}`).join(', ') || '—'
  return (
    <li>
      <Card className="space-y-1 p-4 text-sm">
        <div className="font-medium">
          {block.name} <span className="text-muted-foreground">v{block.version}</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{block.kind}</span>
          <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{m.template_ref}</code>
        </div>
        <div className="text-muted-foreground">in: {io(m.inputs)}</div>
        <div className="text-muted-foreground">out: {io(m.outputs)}</div>
      </Card>
    </li>
  )
}

type IORow = { name: string; type: string; required: boolean }

// Editable list of typed input/output rows (name + type + optional required).
function IORows({
  label,
  rows,
  onChange,
  withRequired,
}: {
  label: string
  rows: IORow[]
  onChange: (rows: IORow[]) => void
  withRequired: boolean
}) {
  const set = (i: number, patch: Partial<IORow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`${label} ${i} name`}
            placeholder="name"
            className="w-32"
            value={r.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <Input
            aria-label={`${label} ${i} type`}
            placeholder="string | enum[A,B] | secretRef"
            className="w-56"
            value={r.type}
            onChange={(e) => set(i, { type: e.target.value })}
          />
          {withRequired && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                aria-label={`${label} ${i} required`}
                checked={r.required}
                onChange={(e) => set(i, { required: e.target.checked })}
              />
              required
            </label>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`remove ${label} ${i}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...rows, { name: '', type: withRequired ? 'string' : 'json', required: false }])}
      >
        <Plus className="h-4 w-4" /> Add {label.toLowerCase().replace(/s$/, '')}
      </Button>
    </div>
  )
}

// The "new block" form: platform-admins fill fields instead of hand-writing YAML.
// It builds a structured manifest and posts it (manifest_json) — the BFF validates.
function NewBlockForm({
  onCreate,
  error,
  pending,
}: {
  onCreate: (m: BlockFormManifest) => void
  error?: string
  pending: boolean
}) {
  const [name, setName] = useState('')
  const [templateRef, setTemplateRef] = useState('')
  const [category, setCategory] = useState('custom')
  const [icon, setIcon] = useState('box')
  const [inputs, setInputs] = useState<IORow[]>([{ name: '', type: 'string', required: true }])
  const [outputs, setOutputs] = useState<IORow[]>([{ name: '', type: 'json', required: false }])

  const clean = (rows: IORow[]) =>
    rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), type: r.type.trim() || 'string', required: r.required }))

  return (
    <Card className="space-y-4 p-4">
      <div className="text-sm font-medium">New function block</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Name *</span>
          <Input aria-label="block name" placeholder="slack-notify" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">WorkflowTemplate ref *</span>
          <Input aria-label="template ref" placeholder="fn-slack-notify" value={templateRef} onChange={(e) => setTemplateRef(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <Input aria-label="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Icon</span>
          <Input aria-label="icon" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </label>
      </div>

      <IORows label="Inputs" rows={inputs} onChange={setInputs} withRequired />
      <IORows label="Outputs" rows={outputs} onChange={setOutputs} withRequired={false} />

      <p className="text-xs text-muted-foreground">
        Types: string · number · boolean · json · enum[A,B] · map&lt;string,T&gt; · jsonpath · secretRef.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        disabled={!name.trim() || !templateRef.trim() || pending}
        onClick={() =>
          onCreate({
            name: name.trim(),
            category: category.trim() || 'custom',
            icon: icon.trim() || 'box',
            template_ref: templateRef.trim(),
            inputs: clean(inputs),
            outputs: clean(outputs).map(({ name: n, type }) => ({ name: n, type, required: false })),
          })
        }
      >
        Create block
      </Button>
    </Card>
  )
}

// Platform block-onboarding screen (design §9): a form builds the block manifest ->
// validated via POST /api/blocks (the BFF is the authz + validation gate) -> the
// block joins the registry list. Admin-only; the server enforces it too.
export function BlockOnboard() {
  const { hasRole, isLoading } = useAuth()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['blocks'], queryFn: fetchBlocks })
  const onboard = useMutation({
    mutationFn: (m: BlockFormManifest) => onboardBlockForm(m),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['blocks'] }),
  })

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-8 text-muted-foreground">Loading…</div>
  if (!hasRole('platform-admin'))
    return (
      <div className="mx-auto max-w-4xl space-y-2 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Function Blocks</h1>
        <p role="alert" className="text-sm text-destructive">
          You need the platform-admin role to onboard function blocks.
        </p>
      </div>
    )

  const items = data?.items ?? []
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Function Blocks</h1>
        <p className="text-sm text-muted-foreground">
          Register a reusable block: its Argo WorkflowTemplate ref and its typed inputs/outputs.
        </p>
      </div>

      <NewBlockForm
        onCreate={(m) => onboard.mutate(m)}
        error={onboard.isError ? (onboard.error as Error).message : undefined}
        pending={onboard.isPending}
      />

      <div>
        <h2 className="mb-2 text-lg font-medium">Registered blocks</h2>
        {items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No blocks yet.</Card>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <BlockRow key={`${b.name}-${b.version}`} block={b} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
