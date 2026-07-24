import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '@/lib/api'
import { approveRequest, fetchQueue, rejectRequest, type ChangeRequest } from '@/lib/requests'
import { DiffView } from './diff'

function QueueItem({ req }: { req: ChangeRequest }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [stale, setStale] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['approval-queue'] })
  const approve = useMutation({
    // First attempt omits confirm_stale; a stale resource re-confirms explicitly.
    mutationFn: (confirmStale: boolean) => approveRequest(req.id, { note, confirm_stale: confirmStale }),
    onSuccess: () => {
      setStale(false)
      refresh()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setStale(true)
    },
  })
  const reject = useMutation({
    mutationFn: () => rejectRequest(req.id, { note }),
    onSuccess: refresh,
  })

  return (
    <li className="border rounded p-4 space-y-3">
      <div className="text-sm">
        <Link
          to="/requests/$requestId"
          params={{ requestId: String(req.id) }}
          className="text-blue-600 hover:underline font-medium"
        >
          #{req.id} {req.action} {req.resource_type}
        </Link>
        <span className="ml-2 text-gray-500">by {req.requester}</span>
        <span className="ml-2 text-gray-400">
          {req.approval_policy.mode}
          {req.approval_policy.n ? `(${req.approval_policy.n})` : ''} · {req.approvals.length} approved
        </span>
      </div>
      <DiffView resourceId={req.resource_id} proposed={req.payload} />
      {req.can_approve && (
        <div className="flex items-center gap-2">
          <input
            aria-label="note"
            placeholder="Note (optional)"
            className="border rounded px-2 py-1 text-sm flex-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            onClick={() => approve.mutate(false)}
            disabled={approve.isPending}
            className="bg-green-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => reject.mutate()}
            disabled={reject.isPending}
            className="bg-red-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
      {req.can_approve && stale && (
        <div className="flex items-center gap-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span role="alert">
            This resource changed in Git since the request was submitted — the diff above may be
            stale. Review again before approving.
          </span>
          <button
            onClick={() => approve.mutate(true)}
            disabled={approve.isPending}
            className="ml-auto bg-amber-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            Approve anyway
          </button>
        </div>
      )}
    </li>
  )
}

// Approval queue — pending requests the caller may approve (server-filtered),
// each with a current-vs-proposed diff and approve/reject + note.
export function ApprovalQueue() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: fetchQueue,
  })
  const items = data?.items ?? []

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Approval Queue</h1>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load queue.</p>}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-gray-500">Nothing awaiting your approval.</p>
      )}
      <ul className="space-y-4">
        {items.map((r) => (
          <QueueItem key={r.id} req={r} />
        ))}
      </ul>
    </div>
  )
}
