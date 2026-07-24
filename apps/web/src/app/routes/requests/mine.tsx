import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchMyRequests } from '@/lib/requests'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'

// My requests — the requester's own requests with live state.
export function MyRequests() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-requests'],
    queryFn: fetchMyRequests,
  })
  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Requests</h1>
        <p className="text-sm text-muted-foreground">Change requests you have submitted.</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load requests.</p>}
      {!isLoading && !isError && items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No requests yet.</Card>
      )}
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm transition-colors hover:border-ring">
              <Link
                to="/requests/$requestId"
                params={{ requestId: String(r.id) }}
                className="font-medium text-primary hover:underline"
              >
                #{r.id} {r.action} {r.resource_type}
              </Link>
              <span className="text-muted-foreground">{r.owner_team}</span>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline">{r.approval_policy.mode}</Badge>
                <StatusBadge status={r.state} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
