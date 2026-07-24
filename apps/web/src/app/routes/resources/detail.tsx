import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Pencil, Trash2 } from 'lucide-react'
import { fetchHistory, fetchResource } from '@/lib/catalog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'

// Resource detail: parsed fields, owner team, current Git SHA, raw JSON, and
// change history from git log. An in-flight-request badge is deferred to E05.
export function ResourceDetail({ id }: { id: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => fetchResource(id),
  })
  const { data: history } = useQuery({
    queryKey: ['resource-history', id],
    queryFn: () => fetchHistory(id),
  })

  if (isLoading) return <p className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">Loading…</p>
  if (isError || !data)
    return <p className="mx-auto max-w-4xl px-4 py-8 text-sm text-destructive">Resource not found.</p>

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            {data.status === 'invalid' && <StatusBadge status="invalid" />}
          </div>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.type}</span>
            <span>· owned by {data.owner_team} ·</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{data.git_sha.slice(0, 8)}</code>
          </p>
        </div>
        {/* Trigger a change request against this resource (routes to its owner team). */}
        <div className="flex shrink-0 gap-2">
          <Link
            to="/requests/new"
            search={{ type: data.type, action: 'UPDATE', resourceId: id }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Pencil className="h-4 w-4" /> Request update
          </Link>
          <Link
            to="/requests/new"
            search={{ type: data.type, action: 'DELETE', resourceId: id }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Trash2 className="h-4 w-4" /> Request delete
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raw JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
            {JSON.stringify(data.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(history ?? []).map((h) => (
              <li key={h.sha} className="flex flex-wrap items-baseline gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {h.sha.slice(0, 8)}
                </code>
                <span>{h.message}</span>
                <span className="text-muted-foreground">— {h.author}</span>
              </li>
            ))}
            {(history ?? []).length === 0 && (
              <li className="text-muted-foreground">No history yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
