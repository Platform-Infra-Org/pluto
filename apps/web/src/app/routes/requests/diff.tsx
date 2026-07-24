import { useQuery } from '@tanstack/react-query'
import { fetchResource } from '@/lib/catalog'

// Current (from the catalog) vs proposed (the request payload), side by side.
// ponytail: whole-JSON panes, not a line differ — a differ lib is E09 polish.
export function DiffView({ resourceId, proposed }: { resourceId: number | null; proposed: unknown }) {
  const { data: current } = useQuery({
    queryKey: ['resource', resourceId],
    queryFn: () => fetchResource(resourceId as number),
    enabled: resourceId != null,
  })

  return (
    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
      <div>
        <div className="mb-1 font-medium text-muted-foreground">Current</div>
        <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-2">
          {resourceId == null ? '(new resource)' : JSON.stringify(current?.payload ?? {}, null, 2)}
        </pre>
      </div>
      <div>
        <div className="mb-1 font-medium text-primary">Proposed</div>
        <pre className="overflow-auto rounded-md border border-primary/30 bg-primary/5 p-2">
          {JSON.stringify(proposed, null, 2)}
        </pre>
      </div>
    </div>
  )
}
