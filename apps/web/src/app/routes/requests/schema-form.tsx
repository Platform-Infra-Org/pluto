import { useState } from 'react'

// Minimal headless JSON-Schema field mapping. Renders one input per top-level
// scalar property and enforces `required`. The full shared SchemaForm (nested
// objects, arrays, server-backed fields) is formalized in E08 — this covers the
// scalar create/update case the request form needs today.
// ponytail: scalars only; nested schemas fall back to a JSON textarea.

export interface JsonSchema {
  properties?: Record<string, { type?: string; title?: string; enum?: string[] }>
  required?: string[]
}

type Values = Record<string, unknown>

function coerce(type: string | undefined, raw: string): unknown {
  if (type === 'number' || type === 'integer') return raw === '' ? '' : Number(raw)
  if (type === 'boolean') return raw === 'true'
  return raw
}

export function SchemaForm({
  schema,
  onSubmit,
  submitting,
}: {
  schema: JsonSchema
  onSubmit: (values: Values) => void
  submitting?: boolean
}) {
  const props = schema.properties ?? {}
  const required = schema.required ?? []
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing = required.filter((k) => {
      const v = values[k]
      return v === undefined || v === '' || v === null
    })
    setErrors(missing)
    if (missing.length === 0) onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {Object.entries(props).map(([name, spec]) => (
        <label key={name} className="block">
          <span className="text-sm font-medium">
            {spec.title ?? name}
            {required.includes(name) && <span className="text-red-600"> *</span>}
          </span>
          {spec.enum ? (
            <select
              aria-label={name}
              className="border rounded px-2 py-1 w-full"
              value={String(values[name] ?? '')}
              onChange={(ev) => setValues((v) => ({ ...v, [name]: ev.target.value }))}
            >
              <option value="" />
              {spec.enum.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={name}
              className="border rounded px-2 py-1 w-full"
              value={String(values[name] ?? '')}
              onChange={(ev) =>
                setValues((v) => ({ ...v, [name]: coerce(spec.type, ev.target.value) }))
              }
            />
          )}
          {errors.includes(name) && (
            <span className="text-xs text-red-600">{name} is required</span>
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-4 py-1.5 disabled:opacity-50"
      >
        Submit request
      </button>
    </form>
  )
}
