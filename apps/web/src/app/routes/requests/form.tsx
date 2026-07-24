import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { submitRequest } from '@/lib/requests'
import { SchemaForm, type JsonSchema, type UiSchema } from '@/app/forms/SchemaForm'

// Schema-driven change request form (E05), now rendering with the shared E08
// SchemaForm so the builder preview and the real form are one path. The type's
// JSON Schema is served by the BFF from the Service Definition. Ownership /
// policy / validation are all re-enforced by the BFF on submit.
export function RequestForm({
  resourceType,
  action = 'UPDATE',
  resourceId = null,
  schema,
  uiSchema,
}: {
  resourceType: string
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceId?: number | null
  schema: JsonSchema
  uiSchema?: UiSchema
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitRequest({ action, resource_type: resourceType, resource_id: resourceId, payload }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing: Record<string, string> = {}
    for (const key of schema.required ?? []) {
      const v = values[key]
      if (v === undefined || v === '' || v === null) missing[key] = `${key} is required`
    }
    setErrors(missing)
    if (Object.keys(missing).length === 0) mutation.mutate({ spec: values })
  }

  return (
    <div className="p-8 space-y-4 max-w-lg">
      <h1 className="text-2xl font-semibold">
        {action} {resourceType}
      </h1>
      {mutation.isSuccess ? (
        <p className="text-green-700">
          Request #{mutation.data.id} submitted — state {mutation.data.state}.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <SchemaForm schema={schema} uiSchema={uiSchema} value={values} onChange={setValues} errors={errors} />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-blue-600 text-white rounded px-4 py-1.5 disabled:opacity-50"
          >
            Submit request
          </button>
        </form>
      )}
      {mutation.isError && <p className="text-red-600">Submit failed.</p>}
    </div>
  )
}
