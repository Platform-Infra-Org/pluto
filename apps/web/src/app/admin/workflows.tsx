import { useQuery } from '@tanstack/react-query'
import { fetchAdminWorkflows, type AdminRequest } from '@/lib/admin'
import { StatusBadge } from '@/components/ui/badge'
import { DataTable, type Column } from './table'

const COLUMNS: Column<AdminRequest>[] = [
  { key: 'id', header: 'Request', cell: (r) => `#${r.id}` },
  { key: 'wf', header: 'Workflow', cell: (r) => r.workflow_ref ?? '—' },
  { key: 'state', header: 'State', cell: (r) => <StatusBadge status={r.state} /> },
  {
    key: 'failed',
    header: 'Failed step',
    cell: (r) =>
      r.failure ? (
        <span className="text-destructive">
          {r.failure.node ?? r.failure.phase}: {r.failure.message}
        </span>
      ) : (
        '—'
      ),
  },
]

// Recent workflow runs + failed steps (E09 Task 2, sourced from E06).
export function AdminWorkflows() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-workflows'],
    queryFn: fetchAdminWorkflows,
  })
  return (
    <section aria-labelledby="workflows-heading" className="space-y-4">
      <h2 id="workflows-heading" className="text-lg font-semibold tracking-tight">
        Workflow runs
      </h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load workflows.</p>}
      {data && (
        <DataTable
          caption="Recent workflow runs and their failed steps"
          columns={COLUMNS}
          rows={data.items}
          rowKey={(r) => r.id}
          empty="No workflow runs yet."
        />
      )}
    </section>
  )
}
