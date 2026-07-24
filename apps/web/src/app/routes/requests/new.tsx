import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { apiFetch } from '@/lib/api'
import { fetchResources } from '@/lib/catalog'
import type { JsonSchema, UiSchema } from '@/app/forms/SchemaForm'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { RequestForm } from './form'

// /requests/new — loads the type's form schema from the BFF (served from the
// ACTIVE ServiceDefinition) and renders it with the shared SchemaForm. Closes
// the E05 gap where RequestForm had no schema source.
interface TypeSchema {
  resource_type: string
  form_schema: JsonSchema
  ui_schema?: UiSchema
}

// When no type is chosen, let the user pick which kind of resource to request.
// Types are the distinct kinds present in the catalog they can see.
function TypePicker() {
  const { data } = useQuery({ queryKey: ['resources'], queryFn: () => fetchResources() })
  const types = Array.from(new Set((data?.items ?? []).map((r) => r.type))).sort()

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="text-sm text-muted-foreground">
          Choose a resource type to request. Approval routes to that type&apos;s owner team.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-2 pt-5">
          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resource types are available yet. Onboard one in the Service Builder first.
            </p>
          ) : (
            types.map((t) => (
              <Link
                key={t}
                to="/requests/new"
                search={{ type: t, action: 'CREATE', resourceId: 0 }}
                className={buttonVariants({ variant: 'outline' }) + ' w-full justify-between'}
              >
                <span className="font-medium">{t}</span>
                <span className="text-muted-foreground">Request &rarr;</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
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
  const hasType = resourceType.trim().length > 0
  const { data, isLoading, isError } = useQuery({
    queryKey: ['type-schema', resourceType],
    queryFn: () => apiFetch<TypeSchema>(`/services/type-schema/${resourceType}`),
    enabled: hasType,
  })

  if (!hasType) return <TypePicker />

  if (isLoading)
    return <p className="mx-auto max-w-lg px-4 py-8 text-sm text-muted-foreground">Loading form…</p>
  if (isError || !data)
    return (
      <p className="mx-auto max-w-lg px-4 py-8 text-sm text-destructive">
        Failed to load the form schema.
      </p>
    )

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
