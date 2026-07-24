import type { BuilderField, FieldType } from './schema'

const TYPES: FieldType[] = ['string', 'number', 'boolean', 'enum', 'groups', 'upload', 'options']

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
    <div className="border rounded p-3 space-y-2">
      <div className="flex gap-2">
        <input
          aria-label="field key"
          placeholder="key"
          className="border rounded px-2 py-1 flex-1"
          value={field.key}
          onChange={(e) => set({ key: e.target.value })}
        />
        <input
          aria-label="field label"
          placeholder="label"
          className="border rounded px-2 py-1 flex-1"
          value={field.label ?? ''}
          onChange={(e) => set({ label: e.target.value })}
        />
        <select
          aria-label="field type"
          className="border rounded px-2 py-1"
          value={field.type}
          onChange={(e) => set({ type: e.target.value as FieldType })}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input
            aria-label="field required"
            type="checkbox"
            checked={Boolean(field.required)}
            onChange={(e) => set({ required: e.target.checked })}
          />
          req
        </label>
        <button type="button" className="text-red-600 text-sm" onClick={onRemove}>
          remove
        </button>
      </div>
      {field.type === 'enum' && (
        <input
          aria-label="enum values"
          placeholder="comma,separated,values"
          className="border rounded px-2 py-1 w-full"
          value={(field.enumValues ?? []).join(',')}
          onChange={(e) =>
            set({ enumValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
      )}
    </div>
  )
}
