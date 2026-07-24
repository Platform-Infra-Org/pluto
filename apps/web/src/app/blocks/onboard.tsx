import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  editBlock,
  fetchBlocks,
  onboardBlockForm,
  type Block,
  type BlockFormManifest,
  type BlockManifestDto,
} from '@/lib/blocks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Base IO kinds offered by the type choice box (design §3). enum/map take a sub-field.
const KINDS = ['string', 'number', 'boolean', 'json', 'jsonpath', 'secretRef', 'enum', 'map'] as const
// A map value can be any scalar (map keys are always string).
const MAP_VALUE_KINDS = ['string', 'number', 'boolean', 'json', 'jsonpath'] as const

type IORow = { name: string; kind: string; enumValues: string; mapValue: string; required: boolean }

// Build the manifest type string from a row's structured choice-box state.
function buildType(r: IORow): string {
  if (r.kind === 'enum') {
    const vals = r.enumValues
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    return `enum[${vals.join(',')}]`
  }
  if (r.kind === 'map') return `map<string,${r.mapValue || 'string'}>`
  return r.kind
}

// Decode a stored type string back into the choice-box sub-fields (for editing).
function decodeType(type: string): Pick<IORow, 'kind' | 'enumValues' | 'mapValue'> {
  if (type.startsWith('enum[') && type.endsWith(']'))
    return { kind: 'enum', enumValues: type.slice(5, -1), mapValue: 'string' }
  const m = /^map<string,(.+)>$/.exec(type)
  if (m) return { kind: 'map', enumValues: '', mapValue: m[1] }
  return { kind: type, enumValues: '', mapValue: 'string' }
}

function decodeRow(f: { name: string; type: string; required?: boolean }): IORow {
  return { name: f.name, required: !!f.required, ...decodeType(f.type) }
}

const emptyRow = (required: boolean, kind = 'string'): IORow => ({
  name: '',
  kind,
  enumValues: '',
  mapValue: 'string',
  required,
})

// One row per registered block: its kind + template ref + typed IO, plus an Edit button.
function BlockRow({ block, onEdit }: { block: Block; onEdit: (b: Block) => void }) {
  const m = block.manifest
  const io = (fields: { name: string; type: string; required?: boolean }[]) =>
    fields.map((f) => `${f.name}: ${f.type}${f.required ? '' : '?'}`).join(', ') || '—'
  return (
    <li>
      <Card className="space-y-1 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{block.name}</span>
          <span className="text-muted-foreground">v{block.version}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{block.kind}</span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.template_ref}</code>
          {block.kind === 'function' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              aria-label={`edit ${block.name}`}
              onClick={() => onEdit(block)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
        </div>
        <div className="text-muted-foreground">in: {io(m.inputs)}</div>
        <div className="text-muted-foreground">out: {io(m.outputs)}</div>
      </Card>
    </li>
  )
}

// Editable list of typed input/output rows: name + type choice box (+ enum/map sub-fields).
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
  const selectClass =
    'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
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
          <select
            aria-label={`${label} ${i} type`}
            className={selectClass}
            value={r.kind}
            onChange={(e) => set(i, { kind: e.target.value })}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          {r.kind === 'enum' && (
            <Input
              aria-label={`${label} ${i} enum values`}
              placeholder="GET,POST,PUT"
              className="w-40"
              value={r.enumValues}
              onChange={(e) => set(i, { enumValues: e.target.value })}
            />
          )}
          {r.kind === 'map' && (
            <select
              aria-label={`${label} ${i} value type`}
              className={selectClass}
              value={r.mapValue}
              onChange={(e) => set(i, { mapValue: e.target.value })}
            >
              {MAP_VALUE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
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
        onClick={() => onChange([...rows, emptyRow(false, withRequired ? 'string' : 'json')])}
      >
        <Plus className="h-4 w-4" /> Add {label.toLowerCase().replace(/s$/, '')}
      </Button>
    </div>
  )
}

// Convert a stored block manifest into the form's editable state.
function manifestToForm(m: BlockManifestDto) {
  return {
    name: m.name,
    templateRef: m.template_ref,
    entrypoint: m.entrypoint || 'run',
    category: m.category,
    icon: m.icon,
    inputs: (m.inputs.length ? m.inputs : [emptyRowIO(true)]).map(decodeRow),
    outputs: (m.outputs.length ? m.outputs : [emptyRowIO(false)]).map(decodeRow),
  }
}
const emptyRowIO = (required: boolean) => ({ name: '', type: required ? 'string' : 'json', required })

const BLANK = {
  name: '',
  templateRef: '',
  entrypoint: 'run',
  category: 'custom',
  icon: 'box',
  inputs: [emptyRow(true)],
  outputs: [emptyRow(false, 'json')],
}
type FormState = typeof BLANK

// The block form: platform-admins fill fields instead of hand-writing YAML. It builds a
// structured manifest (manifest_json) — the BFF validates. Used for both create and edit.
function BlockForm({
  initial,
  editing,
  onSubmit,
  onCancel,
  error,
  pending,
}: {
  initial: FormState
  editing: boolean
  onSubmit: (m: BlockFormManifest) => void
  onCancel: () => void
  error?: string
  pending: boolean
}) {
  const [name, setName] = useState(initial.name)
  const [templateRef, setTemplateRef] = useState(initial.templateRef)
  const [entrypoint, setEntrypoint] = useState(initial.entrypoint)
  const [category, setCategory] = useState(initial.category)
  const [icon, setIcon] = useState(initial.icon)
  const [inputs, setInputs] = useState<IORow[]>(initial.inputs)
  const [outputs, setOutputs] = useState<IORow[]>(initial.outputs)

  const clean = (rows: IORow[]) =>
    rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), type: buildType(r), required: r.required }))

  return (
    <Card className="space-y-4 p-4">
      <div className="text-sm font-medium">{editing ? `Edit block: ${initial.name}` : 'New function block'}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Name *</span>
          <Input aria-label="block name" placeholder="slack-notify" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">WorkflowTemplate *</span>
          <Input aria-label="template ref" placeholder="fn-slack-notify" value={templateRef} onChange={(e) => setTemplateRef(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Entrypoint</span>
          <Input aria-label="entrypoint" placeholder="run" value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} />
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
        The WorkflowTemplate is the Argo template that runs the block; the entrypoint is the template within it (default run).
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!name.trim() || !templateRef.trim() || pending}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              category: category.trim() || 'custom',
              icon: icon.trim() || 'box',
              template_ref: templateRef.trim(),
              entrypoint: entrypoint.trim() || 'run',
              inputs: clean(inputs),
              outputs: clean(outputs).map(({ name: n, type }) => ({ name: n, type })),
            })
          }
        >
          {editing ? 'Save block' : 'Create block'}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  )
}

// Platform block-onboarding screen (design §9): a form builds the block manifest ->
// validated via POST/PUT /api/blocks (the BFF is the authz + validation gate) -> the
// block joins the registry list. Admin-only; the server enforces it too.
export function BlockOnboard() {
  const { hasRole, isLoading } = useAuth()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['blocks'], queryFn: fetchBlocks })
  // The block being edited (null = create mode). `formKey` remounts the form on change
  // so its useState re-seeds from the new initial values.
  const [editingBlock, setEditingBlock] = useState<Block | null>(null)
  const [formKey, setFormKey] = useState(0)

  const submit = useMutation({
    mutationFn: (m: BlockFormManifest) => (editingBlock ? editBlock(m) : onboardBlockForm(m)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blocks'] })
      setEditingBlock(null)
      setFormKey((k) => k + 1)
    },
  })

  const startEdit = (b: Block) => {
    setEditingBlock(b)
    setFormKey((k) => k + 1)
    submit.reset()
  }
  const cancelEdit = () => {
    setEditingBlock(null)
    setFormKey((k) => k + 1)
    submit.reset()
  }

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
          Register a reusable block: its Argo WorkflowTemplate + entrypoint and its typed inputs/outputs.
        </p>
      </div>

      <BlockForm
        key={formKey}
        initial={editingBlock ? manifestToForm(editingBlock.manifest) : BLANK}
        editing={!!editingBlock}
        onSubmit={(m) => submit.mutate(m)}
        onCancel={cancelEdit}
        error={submit.isError ? (submit.error as Error).message : undefined}
        pending={submit.isPending}
      />

      <div>
        <h2 className="mb-2 text-lg font-medium">Registered blocks</h2>
        {items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No blocks yet.</Card>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <BlockRow key={`${b.name}-${b.version}`} block={b} onEdit={startEdit} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
