import type { ApprovalPolicy, PolicyMode, WorkflowBinding } from './schema'

const MODES: PolicyMode[] = ['SINGLE', 'N_OF_M', 'RBAC']

// Workflow binding + approval policy panel. The owner picks the create
// WorkflowTemplate and the type's default approval policy; admins review the
// policy at onboarding (a lax policy on a sensitive type is what onboarding catches).
export function BindingPanel({
  binding,
  policy,
  onBinding,
  onPolicy,
}: {
  binding: WorkflowBinding
  policy: ApprovalPolicy
  onBinding: (b: WorkflowBinding) => void
  onPolicy: (p: ApprovalPolicy) => void
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Create WorkflowTemplate</span>
        <input
          aria-label="template ref"
          className="border rounded px-2 py-1 w-full"
          value={binding.create?.template_ref ?? ''}
          onChange={(e) =>
            onBinding({ create: { template_ref: e.target.value, param_map: binding.create?.param_map ?? {} } })
          }
        />
      </label>
      <div className="flex gap-2 items-end">
        <label className="block">
          <span className="text-sm font-medium">Approval policy</span>
          <select
            aria-label="policy mode"
            className="border rounded px-2 py-1 w-full"
            value={policy.mode}
            onChange={(e) => onPolicy({ mode: e.target.value as PolicyMode, n: policy.n })}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {policy.mode === 'N_OF_M' && (
          <label className="block">
            <span className="text-sm font-medium">n</span>
            <input
              aria-label="policy n"
              type="number"
              min={1}
              className="border rounded px-2 py-1 w-20"
              value={policy.n ?? 2}
              onChange={(e) => onPolicy({ mode: 'N_OF_M', n: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
    </div>
  )
}
