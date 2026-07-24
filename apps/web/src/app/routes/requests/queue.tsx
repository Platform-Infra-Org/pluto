import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { approveRequest, fetchQueue, rejectRequest, type ChangeRequest } from '@/lib/requests'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
    <li>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Link
            to="/requests/$requestId"
            params={{ requestId: String(req.id) }}
            className="font-medium text-primary hover:underline"
          >
            #{req.id} {req.action} {req.resource_type}
          </Link>
          <span className="text-muted-foreground">by {req.requester}</span>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline">
              {req.approval_policy.mode}
              {req.approval_policy.n ? `(${req.approval_policy.n})` : ''}
            </Badge>
            <Badge variant="muted">{req.approvals.length} approved</Badge>
          </div>
        </div>
        <DiffView resourceId={req.resource_id} proposed={req.payload} />
        {req.can_approve && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="note"
              placeholder="Note (optional)"
              className="flex-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button variant="success" size="sm" onClick={() => approve.mutate(false)} disabled={approve.isPending}>
              Approve
            </Button>
            <Button variant="destructive" size="sm" onClick={() => reject.mutate()} disabled={reject.isPending}>
              Reject
            </Button>
          </div>
        )}
        {req.can_approve && stale && (
          <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span role="alert" className="text-foreground/80">
              This resource changed in Git since the request was submitted — the diff above may be
              stale. Review again before approving.
            </span>
            <Button
              variant="default"
              size="sm"
              className="ml-auto"
              onClick={() => approve.mutate(true)}
              disabled={approve.isPending}
            >
              Approve anyway
            </Button>
          </div>
        )}
      </Card>
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
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="text-sm text-muted-foreground">Requests awaiting your review.</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load queue.</p>}
      {!isLoading && !isError && items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nothing awaiting your approval.
        </Card>
      )}
      <ul className="space-y-4">
        {items.map((r) => (
          <QueueItem key={r.id} req={r} />
        ))}
      </ul>
    </div>
  )
}
