import { useQuery } from '@tanstack/react-query'
import { fetchHistory, fetchResource } from '@/lib/catalog'

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

  if (isLoading) return <p className="p-8">Loading…</p>
  if (isError || !data) return <p className="p-8 text-red-600">Resource not found.</p>

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-gray-500">
          {data.type} · owned by {data.owner_team} · {data.git_sha.slice(0, 8)}
          {data.status === 'invalid' && <span className="ml-2 text-amber-600 font-medium">invalid</span>}
        </p>
      </div>

      <section>
        <h2 className="font-medium mb-2">Raw JSON</h2>
        <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto">
          {JSON.stringify(data.payload, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="font-medium mb-2">History</h2>
        <ul className="text-sm space-y-1">
          {(history ?? []).map((h) => (
            <li key={h.sha} className="flex gap-2">
              <code className="text-gray-500">{h.sha.slice(0, 8)}</code>
              <span>{h.message}</span>
              <span className="text-gray-400">— {h.author}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
