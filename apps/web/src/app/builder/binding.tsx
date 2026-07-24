import { Input } from '@/components/ui/input'
import type { ApprovalPolicy, PolicyMode, WorkflowBinding } from './schema'

const selectClass =
  'mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

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
    <div className="space-y-3 border-t border-border pt-4">
      <label className="block">
        <span className="text-sm font-medium">Create WorkflowTemplate</span>
        <Input
          aria-label="template ref"
          className="mt-1"
          value={binding.create?.template_ref ?? ''}
          onChange={(e) =>
            onBinding({ create: { template_ref: e.target.value, param_map: binding.create?.param_map ?? {} } })
          }
        />
      </label>
      <div className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="text-sm font-medium">Approval policy</span>
          <select
            aria-label="policy mode"
            className={selectClass}
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
            <Input
              aria-label="policy n"
              type="number"
              min={1}
              className="mt-1 w-20"
              value={policy.n ?? 2}
              onChange={(e) => onPolicy({ mode: 'N_OF_M', n: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
    </div>
  )
}
