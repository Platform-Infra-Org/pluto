import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { BuilderField, FieldType } from './schema'

const TYPES: FieldType[] = ['string', 'number', 'boolean', 'enum', 'groups', 'upload', 'options']

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Per-field settings row: key, label, type, required, and enum values when the
// type is enum. Controlled by the canvas.
export function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: BuilderField
  onChange: (f: BuilderField) => void
  onRemove: () => void
}) {
  const set = (patch: Partial<BuilderField>) => onChange({ ...field, ...patch })
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="field key"
          placeholder="key"
          className="h-9 flex-1"
          value={field.key}
          onChange={(e) => set({ key: e.target.value })}
        />
        <Input
          aria-label="field label"
          placeholder="label"
          className="h-9 flex-1"
          value={field.label ?? ''}
          onChange={(e) => set({ label: e.target.value })}
        />
        <select
          aria-label="field type"
          className={selectClass}
          value={field.type}
          onChange={(e) => set({ type: e.target.value as FieldType })}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          <input
            aria-label="field required"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-[var(--primary)]"
            checked={Boolean(field.required)}
            onChange={(e) => set({ required: e.target.checked })}
          />
          req
        </label>
        <button
          type="button"
          aria-label="remove"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {field.type === 'enum' && (
        <Input
          aria-label="enum values"
          placeholder="comma,separated,values"
          value={(field.enumValues ?? []).join(',')}
          onChange={(e) =>
            set({ enumValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
      )}
    </div>
  )
}
