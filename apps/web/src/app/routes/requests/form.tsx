import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { submitRequest } from '@/lib/requests'
import { SchemaForm, type JsonSchema, type UiSchema } from '@/app/forms/SchemaForm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {action} {resourceType}
        </h1>
        <p className="text-sm text-muted-foreground">Fill in the fields and submit for approval.</p>
      </div>
      {mutation.isSuccess ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-5 text-sm text-success">
            Request #{mutation.data.id} submitted — state {mutation.data.state}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <SchemaForm schema={schema} uiSchema={uiSchema} value={values} onChange={setValues} errors={errors} />
              <Button type="submit" disabled={mutation.isPending}>
                Submit request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {mutation.isError && <p className="text-sm text-destructive">Submit failed.</p>}
    </div>
  )
}
