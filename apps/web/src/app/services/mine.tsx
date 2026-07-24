import { useQuery } from '@tanstack/react-query'
import { fetchMyDefinitions } from '@/lib/services'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'

// My service definitions with status (DRAFT / PENDING_ONBOARDING / ACTIVE / RETIRED).
export function MyDefinitions() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-definitions'],
    queryFn: fetchMyDefinitions,
  })
  const items = data?.items ?? []
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Service Definitions</h1>
        <p className="text-sm text-muted-foreground">Resource types you maintain.</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load definitions.</p>}
      {!isLoading && items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No definitions yet.</Card>
      )}
      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.id}>
            <Card className="flex items-center justify-between gap-3 p-4 text-sm">
              <span>
                <span className="font-medium">{d.name}</span>{' '}
                <span className="text-muted-foreground">v{d.version}</span>
                <span className="ml-2 text-muted-foreground">{d.owner_team}</span>
              </span>
              <StatusBadge status={d.status} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
