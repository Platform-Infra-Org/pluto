import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchAdminRequests, type AdminRequest } from '@/lib/admin'
import { DataTable, type Column } from './table'

const COLUMNS: Column<AdminRequest>[] = [
  {
    key: 'id',
    header: 'ID',
    cell: (r) => (
      <Link to="/requests/$requestId" params={{ requestId: String(r.id) }} className="text-blue-700 underline">
        #{r.id}
      </Link>
    ),
  },
  { key: 'kind', header: 'Kind', cell: (r) => r.kind },
  { key: 'type', header: 'Type', cell: (r) => `${r.action} ${r.resource_type}` },
  { key: 'team', header: 'Team', cell: (r) => r.owner_team },
  { key: 'requester', header: 'Requester', cell: (r) => r.requester },
  { key: 'state', header: 'State', cell: (r) => r.state },
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
    <section aria-labelledby="requests-heading" className="space-y-3">
      <h2 id="requests-heading" className="text-xl font-semibold">
        All requests
      </h2>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          State{' '}
          <input aria-label="filter by state" value={state} onChange={(e) => setState(e.target.value)}
            className="border rounded px-2 py-1" placeholder="e.g. PENDING_APPROVAL" />
        </label>
        <label className="text-sm">
          Team{' '}
          <input aria-label="filter by team" value={team} onChange={(e) => setTeam(e.target.value)}
            className="border rounded px-2 py-1" placeholder="e.g. payments" />
        </label>
        <label className="text-sm">
          Kind{' '}
          <input aria-label="filter by kind" value={kind} onChange={(e) => setKind(e.target.value)}
            className="border rounded px-2 py-1" placeholder="RESOURCE_CHANGE" />
        </label>
      </div>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load requests.</p>}
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
