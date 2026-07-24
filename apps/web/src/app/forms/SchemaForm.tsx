import type { ReactNode } from 'react'

// Shared headless JSON-Schema renderer (E08 Task 2). ONE renderer for both the
// builder's live preview and the real E05 request form — "what the owner builds"
// == "what the requester sees". Controlled: the parent owns the value + errors.
//
// Base types map to shadcn-style fields; server-backed field types (groups
// picker, file upload, dynamic choice) are supplied via `widgets`, keyed by a
// `ui:widget` hint in the ui-schema, so the backend-served fields render here too
// without this module knowing how to fetch them.

export interface FieldSpec {
  type?: string
  title?: string
  enum?: string[]
  description?: string
}

export interface JsonSchema {
  type?: string
  properties?: Record<string, FieldSpec>
  required?: string[]
}

export type UiSchema = Record<string, { 'ui:widget'?: string; 'ui:help'?: string }>

type Values = Record<string, unknown>

export interface WidgetProps {
  name: string
  spec: FieldSpec
  value: unknown
  onChange: (v: unknown) => void
}

export type Widget = (props: WidgetProps) => ReactNode

// Shared control styling (token-based) so form fields match the design system.
const controlClass =
  'mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring'

function coerce(type: string | undefined, raw: string): unknown {
  if (type === 'number' || type === 'integer') return raw === '' ? '' : Number(raw)
  if (type === 'boolean') return raw === 'true'
  return raw
}

export function SchemaForm({
  schema,
  uiSchema,
  value,
  onChange,
  errors,
  widgets,
}: {
  schema: JsonSchema
  uiSchema?: UiSchema
  value: Values
  onChange: (next: Values) => void
  errors?: Record<string, string>
  widgets?: Record<string, Widget>
}) {
  const props = schema.properties ?? {}
  const required = schema.required ?? []

  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v })

  return (
    <div className="space-y-4">
      {Object.entries(props).map(([name, spec]) => {
        const widgetName = uiSchema?.[name]?.['ui:widget']
        const widget = widgetName ? widgets?.[widgetName] : undefined
        return (
          <label key={name} className="block">
            <span className="text-sm font-medium">
              {spec.title ?? name}
              {required.includes(name) && <span className="text-destructive"> *</span>}
            </span>
            {widget ? (
              widget({ name, spec, value: value[name], onChange: (v) => set(name, v) })
            ) : spec.enum ? (
              <select
                aria-label={name}
                className={controlClass}
                value={String(value[name] ?? '')}
                onChange={(e) => set(name, e.target.value)}
              >
                <option value="" />
                {spec.enum.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : spec.type === 'boolean' ? (
              <input
                aria-label={name}
                type="checkbox"
                className="mt-1 block h-4 w-4 rounded border-input accent-[var(--primary)]"
                checked={Boolean(value[name])}
                onChange={(e) => set(name, e.target.checked)}
              />
            ) : (
              <input
                aria-label={name}
                type={spec.type === 'number' || spec.type === 'integer' ? 'number' : 'text'}
                className={controlClass}
                value={String(value[name] ?? '')}
                onChange={(e) => set(name, coerce(spec.type, e.target.value))}
              />
            )}
            {(uiSchema?.[name]?.['ui:help'] ?? spec.description) && (
              <span className="mt-1 block text-xs text-muted-foreground">
                {uiSchema?.[name]?.['ui:help'] ?? spec.description}
              </span>
            )}
            {errors?.[name] && <span className="mt-1 block text-xs text-destructive">{errors[name]}</span>}
          </label>
        )
      })}
    </div>
  )
}
