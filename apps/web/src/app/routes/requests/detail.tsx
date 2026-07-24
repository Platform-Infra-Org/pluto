import { useQuery } from '@tanstack/react-query'
import { fetchRequest } from '@/lib/requests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { DiffView } from './diff'
import { WorkflowStatusView } from './status'

// Request detail — the diff, resolved policy, and full append-only audit history.
export function RequestDetail({ id }: { id: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['request', id],
    queryFn: () => fetchRequest(id),
  })

  if (isLoading) return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">Loading…</p>
  if (isError || !data)
    return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-destructive">Request not found.</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            #{data.id} {data.action} {data.resource_type}
          </h1>
          <StatusBadge status={data.state} />
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>by {data.requester} · {data.owner_team}</span>
          <Badge variant="outline">
            {data.approval_policy.mode}
            {data.approval_policy.n ? `(${data.approval_policy.n})` : ''}
          </Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change</CardTitle>
        </CardHeader>
        <CardContent>
          <DiffView resourceId={data.resource_id} proposed={data.payload} />
        </CardContent>
      </Card>

      {data.workflow_ref && (
        <Card>
          <CardHeader>
            <CardTitle>Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowStatusView id={data.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {data.events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{e.at?.slice(0, 19).replace('T', ' ')}</span>
                <span>
                  {e.from_state ?? '∅'} → <span className="font-medium">{e.to_state}</span>
                </span>
                <span className="text-muted-foreground">by {e.actor}</span>
                {e.flags.includes('admin_bypass') && <Badge variant="warning">admin bypass</Badge>}
                {e.note && <span className="text-muted-foreground">— {e.note}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
