import { useQuery } from '@tanstack/react-query'
import { fetchMyDefinitions } from '@/lib/services'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'text-gray-500',
  PENDING_ONBOARDING: 'text-amber-600',
  ACTIVE: 'text-green-700',
  RETIRED: 'text-red-600',
}

// My service definitions with status (DRAFT / PENDING_ONBOARDING / ACTIVE / RETIRED).
export function MyDefinitions() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-definitions'],
    queryFn: fetchMyDefinitions,
  })
  const items = data?.items ?? []
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">My Service Definitions</h1>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load definitions.</p>}
      {!isLoading && items.length === 0 && <p className="text-gray-500">No definitions yet.</p>}
      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.id} className="border rounded p-3 text-sm flex justify-between">
            <span>
              {d.name} <span className="text-gray-400">v{d.version}</span>
              <span className="ml-2 text-gray-500">{d.owner_team}</span>
            </span>
            <span className={`font-medium ${STATUS_COLOR[d.status] ?? ''}`}>{d.status}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
