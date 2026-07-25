import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Pencil, Trash2 } from 'lucide-react'
import { fetchHistory, fetchResource } from '@/lib/catalog'
import { submitRequest } from '@/lib/requests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ResourceForm } from './resource-form'
import { ResourceGraph } from './resource-graph'

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
  const del = useMutation({
    mutationFn: () =>
      submitRequest({ action: 'DELETE', resource_type: data!.type, resource_id: id, payload: {} }),
  })
  const [view, setView] = useState<'form' | 'raw'>('form')

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
        {/* Edit/Delete both open a change request routed to the owner team — never applied here. */}
        <div className="flex shrink-0 gap-2">
          <Link
            to="/resources/$resourceId/edit"
            params={{ resourceId: String(id) }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <Button
            variant="outline"
            size="sm"
            disabled={del.isPending || del.isSuccess}
            onClick={() => {
              if (window.confirm(`Send a delete request for ${data.name} to ${data.owner_team} for approval?`))
                del.mutate()
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {del.isSuccess && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-5 text-sm text-success">
            Delete request #{del.data.id} submitted for approval to {del.data.owner_team}.
          </CardContent>
        </Card>
      )}
      {del.isError && <p className="text-sm text-destructive">Delete request failed.</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Definition</CardTitle>
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              aria-label="Form"
              aria-pressed={view === 'form'}
              onClick={() => setView('form')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${view === 'form' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
            >
              Form
            </button>
            <button
              type="button"
              aria-label="Raw JSON"
              aria-pressed={view === 'raw'}
              onClick={() => setView('raw')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${view === 'raw' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
            >
              Raw JSON
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'form' ? (
            <ResourceForm value={data.payload} />
          ) : (
            <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
              {JSON.stringify(data.payload, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dependency graph</CardTitle>
        </CardHeader>
        <CardContent>
          <ResourceGraph id={id} />
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
