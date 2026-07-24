import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SchemaForm } from '@/app/forms/SchemaForm'
import { approveOnboarding, fetchOnboardingQueue, rejectOnboarding, type OnboardingItem } from '@/lib/services'

// Admin onboarding queue: each pending request shows the form preview, the
// workflow binding + parameter map, and the approval policy, with approve/reject.
function QueueRow({ item, onDone }: { item: OnboardingItem; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [value, setValue] = useState<Record<string, unknown>>({})
  const approve = useMutation({ mutationFn: () => approveOnboarding(item.request_id, note), onSuccess: onDone })
  const reject = useMutation({ mutationFn: () => rejectOnboarding(item.request_id, note), onSuccess: onDone })
  const d = item.definition
  return (
    <li className="border rounded p-4 space-y-3">
      <div className="font-medium">
        #{item.request_id} {d?.name} <span className="text-gray-400">v{d?.version}</span>
        <span className="ml-2 text-gray-500 text-sm">by {item.requester}</span>
      </div>
      {d && (
        <>
          <div className="text-sm text-gray-600">
            Binding: <code>{d.workflow_binding?.create?.template_ref || '—'}</code>
            {'  ·  '}
            Policy: <code>{d.approval_policy?.mode}{d.approval_policy?.n ? `(${d.approval_policy.n})` : ''}</code>
          </div>
          <div className="border rounded p-3 bg-gray-50">
            <SchemaForm schema={d.form_schema} uiSchema={d.ui_schema} value={value} onChange={setValue} />
          </div>
        </>
      )}
      <input
        aria-label="review note"
        placeholder="note"
        className="border rounded px-2 py-1 w-full"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="bg-green-700 text-white rounded px-4 py-1.5"
          onClick={() => approve.mutate()}
        >
          Approve
        </button>
        <button
          type="button"
          className="bg-red-600 text-white rounded px-4 py-1.5"
          onClick={() => reject.mutate()}
        >
          Reject
        </button>
      </div>
    </li>
  )
}

export function OnboardingQueue() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['onboarding-queue'],
    queryFn: fetchOnboardingQueue,
  })
  const items = data?.items ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['onboarding-queue'] })
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Onboarding Queue</h1>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load the queue.</p>}
      {!isLoading && items.length === 0 && <p className="text-gray-500">Nothing pending.</p>}
      <ul className="space-y-4">
        {items.map((i) => (
          <QueueRow key={i.request_id} item={i} onDone={refresh} />
        ))}
      </ul>
    </div>
  )
}
