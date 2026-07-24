import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchAdminRequests, type AdminRequest } from '@/lib/admin'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { DataTable, type Column } from './table'

const COLUMNS: Column<AdminRequest>[] = [
  {
    key: 'id',
    header: 'ID',
    cell: (r) => (
      <Link to="/requests/$requestId" params={{ requestId: String(r.id) }} className="font-medium text-primary hover:underline">
        #{r.id}
      </Link>
    ),
  },
  { key: 'kind', header: 'Kind', cell: (r) => r.kind },
  { key: 'type', header: 'Type', cell: (r) => `${r.action} ${r.resource_type}` },
  { key: 'team', header: 'Team', cell: (r) => r.owner_team },
  { key: 'requester', header: 'Requester', cell: (r) => r.requester },
  { key: 'state', header: 'State', cell: (r) => <StatusBadge status={r.state} /> },
]

// Cross-team request table with state/team/kind filters (E09 Task 2). Deep-links
// into the existing request detail view.
export function AdminRequests() {
  const [state, setState] = useState('')
  const [team, setTeam] = useState('')
  const [kind, setKind] = useState('')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-requests', state, team, kind],
    queryFn: () => fetchAdminRequests({ state, team, kind }),
  })

  return (
    <section aria-labelledby="requests-heading" className="space-y-4">
      <h2 id="requests-heading" className="text-lg font-semibold tracking-tight">
        All requests
      </h2>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">State</span>
          <Input aria-label="filter by state" value={state} onChange={(e) => setState(e.target.value)}
            className="w-52" placeholder="e.g. PENDING_APPROVAL" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Team</span>
          <Input aria-label="filter by team" value={team} onChange={(e) => setTeam(e.target.value)}
            className="w-40" placeholder="e.g. payments" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Kind</span>
          <Input aria-label="filter by kind" value={kind} onChange={(e) => setKind(e.target.value)}
            className="w-52" placeholder="RESOURCE_CHANGE" />
        </label>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load requests.</p>}
      {data && (
        <DataTable
          caption="All requests across every team"
          columns={COLUMNS}
          rows={data.items}
          rowKey={(r) => r.id}
          empty="No matching requests."
        />
      )}
    </section>
  )
}
