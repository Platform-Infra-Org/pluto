import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { buildSchema, buildUiSchema, type ApprovalPolicy, type BuilderField, type WorkflowBinding } from './schema'
import { createDefinition, submitDefinition } from '@/lib/services'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldEditor } from './field-editor'
import { BindingPanel } from './binding'
import { Preview } from './preview'

// The builder canvas: field list + per-field editor + binding/policy panel +
// live preview. Service-owner-only (display gate; the BFF re-enforces the role).
export function BuilderCanvas() {
  const { hasRole } = useAuth()
  const [name, setName] = useState('')
  const [fields, setFields] = useState<BuilderField[]>([])
  const [binding, setBinding] = useState<WorkflowBinding>({ create: { template_ref: '', param_map: {} } })
  const [policy, setPolicy] = useState<ApprovalPolicy>({ mode: 'SINGLE' })
  const [defId, setDefId] = useState<number | null>(null)

  const save = useMutation({
    mutationFn: () =>
      createDefinition({
        name,
        form_schema: buildSchema(fields),
        ui_schema: buildUiSchema(fields),
        workflow_binding: binding,
        approval_policy: policy,
      }),
    onSuccess: (d) => setDefId(d.id),
  })
  const submit = useMutation({ mutationFn: () => submitDefinition(defId as number) })

  if (!hasRole('service-owner')) {
    return <p className="mx-auto max-w-lg px-4 py-8 text-sm text-destructive">Service owner access required.</p>
  }

  const setField = (i: number, f: BuilderField) =>
    setFields((fs) => fs.map((x, j) => (j === i ? f : x)))

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service Builder</h1>
          <p className="text-sm text-muted-foreground">Define a self-service resource type.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Definition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              aria-label="service name"
              placeholder="service type name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="space-y-2">
              {fields.map((f, i) => (
                <FieldEditor
                  key={i}
                  field={f}
                  onChange={(nf) => setField(i, nf)}
                  onRemove={() => setFields((fs) => fs.filter((_, j) => j !== i))}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setFields((fs) => [...fs, { key: '', type: 'string' }])}
            >
              + add field
            </Button>
            <BindingPanel binding={binding} policy={policy} onBinding={setBinding} onPolicy={setPolicy} />
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={!name || save.isPending} onClick={() => save.mutate()}>
            Save draft
          </Button>
          <Button
            type="button"
            variant="success"
            disabled={defId === null || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit for onboarding
          </Button>
          {save.isSuccess && <span className="text-sm text-success">Saved draft #{defId}.</span>}
          {submit.isSuccess && (
            <span className="text-sm text-success">Submitted for onboarding — {submit.data.state}.</span>
          )}
        </div>
      </div>
      <Preview fields={fields} />
    </div>
  )
}
