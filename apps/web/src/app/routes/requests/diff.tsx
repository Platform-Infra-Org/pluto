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
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <div className="font-medium mb-1">Current</div>
        <pre className="bg-gray-50 border rounded p-2 overflow-auto">
          {resourceId == null ? '(new resource)' : JSON.stringify(current?.payload ?? {}, null, 2)}
        </pre>
      </div>
      <div>
        <div className="font-medium mb-1">Proposed</div>
        <pre className="bg-amber-50 border rounded p-2 overflow-auto">
          {JSON.stringify(proposed, null, 2)}
        </pre>
      </div>
    </div>
  )
}
