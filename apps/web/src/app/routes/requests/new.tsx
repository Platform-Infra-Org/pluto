import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { JsonSchema, UiSchema } from '@/app/forms/SchemaForm'
import { RequestForm } from './form'

// /requests/new — loads the type's form schema from the BFF (served from the
// ACTIVE ServiceDefinition) and renders it with the shared SchemaForm. Closes
// the E05 gap where RequestForm had no schema source.
interface TypeSchema {
  resource_type: string
  form_schema: JsonSchema
  ui_schema?: UiSchema
}

export function NewRequest({
  resourceType,
  action = 'CREATE',
  resourceId = null,
}: {
  resourceType: string
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceId?: number | null
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['type-schema', resourceType],
    queryFn: () => apiFetch<TypeSchema>(`/services/type-schema/${resourceType}`),
  })

  if (isLoading) return <p className="p-8">Loading form…</p>
  if (isError || !data) return <p className="p-8 text-red-600">Failed to load the form schema.</p>

  return (
    <RequestForm
      resourceType={resourceType}
      action={action}
      resourceId={resourceId}
      schema={data.form_schema}
      uiSchema={data.ui_schema}
    />
  )
}
