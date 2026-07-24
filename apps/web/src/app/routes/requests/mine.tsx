import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchMyRequests } from '@/lib/requests'

// My requests — the requester's own requests with live state.
export function MyRequests() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-requests'],
    queryFn: fetchMyRequests,
  })
  const items = data?.items ?? []

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">My Requests</h1>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load requests.</p>}
      {!isLoading && !isError && items.length === 0 && <p className="text-gray-500">No requests yet.</p>}
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="border rounded p-3 text-sm">
            <Link
              to="/requests/$requestId"
              params={{ requestId: String(r.id) }}
              className="text-blue-600 hover:underline"
            >
              #{r.id} {r.action} {r.resource_type}
            </Link>
            <span className="ml-2 text-gray-500">{r.owner_team}</span>
            <span className="ml-2 font-medium">{r.state}</span>
            <span className="ml-2 text-gray-400">{r.approval_policy.mode}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
