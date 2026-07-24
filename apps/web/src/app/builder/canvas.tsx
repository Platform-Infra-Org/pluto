import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { buildSchema, buildUiSchema, type ApprovalPolicy, type BuilderField, type WorkflowBinding } from './schema'
import { createDefinition, submitDefinition } from '@/lib/services'
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
    return <p className="p-8 text-red-600">Service owner access required.</p>
  }

  const setField = (i: number, f: BuilderField) =>
    setFields((fs) => fs.map((x, j) => (j === i ? f : x)))

  return (
    <div className="p-8 grid grid-cols-2 gap-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Service Builder</h1>
        <input
          aria-label="service name"
          placeholder="service type name"
          className="border rounded px-2 py-1 w-full"
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
        <button
          type="button"
          className="text-blue-600 text-sm"
          onClick={() => setFields((fs) => [...fs, { key: '', type: 'string' }])}
        >
          + add field
        </button>
        <BindingPanel binding={binding} policy={policy} onBinding={setBinding} onPolicy={setPolicy} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!name || save.isPending}
            className="bg-blue-600 text-white rounded px-4 py-1.5 disabled:opacity-50"
            onClick={() => save.mutate()}
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={defId === null || submit.isPending}
            className="bg-green-700 text-white rounded px-4 py-1.5 disabled:opacity-50"
            onClick={() => submit.mutate()}
          >
            Submit for onboarding
          </button>
        </div>
        {save.isSuccess && <p className="text-green-700 text-sm">Saved draft #{defId}.</p>}
        {submit.isSuccess && (
          <p className="text-green-700 text-sm">Submitted for onboarding — {submit.data.state}.</p>
        )}
      </div>
      <Preview fields={fields} />
    </div>
  )
}
