import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { fetchResources } from '@/lib/catalog'

// My Resources — RBAC/ownership filtering is enforced by the BFF; this list only
// renders what the caller is allowed to see, plus a client-side text filter.
export function ResourceList() {
  const [filter, setFilter] = useState('')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['resources'],
    queryFn: () => fetchResources(),
  })

  const items = data?.items ?? []
  const needle = filter.toLowerCase()
  const shown = items.filter((r) =>
    `${r.name} ${r.type} ${r.owner_team} ${r.status}`.toLowerCase().includes(needle),
  )

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">My Resources</h1>
      <input
        className="border rounded px-3 py-1.5 w-64"
        placeholder="Filter resources…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load resources.</p>}
      {!isLoading && !isError && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Owner team</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">
                  {/* client-side nav — a full-page anchor would reload the SPA and drop the in-memory token */}
                  <Link
                    to="/resources/$resourceId"
                    params={{ resourceId: String(r.id) }}
                    className="text-blue-600 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{r.type}</td>
                <td className="py-2 pr-4">{r.owner_team}</td>
                <td className="py-2 pr-4">
                  {r.status === 'invalid' ? (
                    <span className="text-amber-600 font-medium">invalid</span>
                  ) : (
                    r.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
