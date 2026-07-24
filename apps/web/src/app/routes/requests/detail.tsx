import { useQuery } from '@tanstack/react-query'
import { fetchRequest } from '@/lib/requests'
import { DiffView } from './diff'

// Request detail — the diff, resolved policy, and full append-only audit history.
export function RequestDetail({ id }: { id: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['request', id],
    queryFn: () => fetchRequest(id),
  })

  if (isLoading) return <p className="p-8">Loading…</p>
  if (isError || !data) return <p className="p-8 text-red-600">Request not found.</p>

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">
          #{data.id} {data.action} {data.resource_type}
        </h1>
        <p className="text-sm text-gray-500">
          by {data.requester} · {data.owner_team} · policy {data.approval_policy.mode}
          {data.approval_policy.n ? `(${data.approval_policy.n})` : ''} ·{' '}
          <span className="font-medium">{data.state}</span>
        </p>
      </div>

      <section>
        <h2 className="font-medium mb-2">Change</h2>
        <DiffView resourceId={data.resource_id} proposed={data.payload} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Audit history</h2>
        <ul className="text-sm space-y-1">
          {data.events.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gray-400">{e.at?.slice(0, 19).replace('T', ' ')}</span>
              <span>
                {e.from_state ?? '∅'} → <span className="font-medium">{e.to_state}</span>
              </span>
              <span className="text-gray-500">by {e.actor}</span>
              {e.flags.includes('admin_bypass') && (
                <span className="text-amber-600 font-medium">admin bypass</span>
              )}
              {e.note && <span className="text-gray-400">— {e.note}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
