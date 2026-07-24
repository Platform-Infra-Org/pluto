import { useMutation } from '@tanstack/react-query'
import { submitRequest } from '@/lib/requests'
import { SchemaForm, type JsonSchema } from './schema-form'

// Schema-driven change request form. The type's JSON Schema is passed in; E08
// serves it from the Service Definition. Ownership/policy/validation are all
// re-enforced by the BFF on submit.
export function RequestForm({
  resourceType,
  action = 'UPDATE',
  resourceId = null,
  schema,
}: {
  resourceType: string
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceId?: number | null
  schema: JsonSchema
}) {
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitRequest({ action, resource_type: resourceType, resource_id: resourceId, payload }),
  })

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
        <SchemaForm
          schema={schema}
          submitting={mutation.isPending}
          onSubmit={(values) => mutation.mutate({ spec: values })}
        />
      )}
      {mutation.isError && <p className="text-red-600">Submit failed.</p>}
    </div>
  )
}
