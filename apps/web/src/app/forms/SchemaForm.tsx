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
              {required.includes(name) && <span className="text-red-600"> *</span>}
            </span>
            {widget ? (
              widget({ name, spec, value: value[name], onChange: (v) => set(name, v) })
            ) : spec.enum ? (
              <select
                aria-label={name}
                className="border rounded px-2 py-1 w-full"
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
                checked={Boolean(value[name])}
                onChange={(e) => set(name, e.target.checked)}
              />
            ) : (
              <input
                aria-label={name}
                type={spec.type === 'number' || spec.type === 'integer' ? 'number' : 'text'}
                className="border rounded px-2 py-1 w-full"
                value={String(value[name] ?? '')}
                onChange={(e) => set(name, coerce(spec.type, e.target.value))}
              />
            )}
            {(uiSchema?.[name]?.['ui:help'] ?? spec.description) && (
              <span className="text-xs text-gray-500">
                {uiSchema?.[name]?.['ui:help'] ?? spec.description}
              </span>
            )}
            {errors?.[name] && <span className="text-xs text-red-600">{errors[name]}</span>}
          </label>
        )
      })}
    </div>
  )
}
