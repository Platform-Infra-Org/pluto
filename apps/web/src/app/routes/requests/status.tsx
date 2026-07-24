import { useQuery } from '@tanstack/react-query'
import { fetchRequestStatus, type WorkflowNode } from '@/lib/requests'

const TERMINAL = new Set(['Succeeded', 'Failed', 'Error'])

const PHASE_ICON: Record<string, string> = {
  Succeeded: '✓',
  Failed: '✗',
  Error: '✗',
  Running: '●',
  Pending: '○',
  Skipped: '–',
  Omitted: '–',
}

// Live workflow status — node/step list with the failed step highlighted.
// Polls until the workflow reaches a terminal phase (SSE push arrives in E07).
export function WorkflowStatusView({ id }: { id: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['request-status', id],
    queryFn: () => fetchRequestStatus(id),
    refetchInterval: (q) => (TERMINAL.has(q.state.data?.phase ?? '') ? false : 2000),
  })

  if (isLoading) return <p className="p-8">Loading status…</p>
  if (isError || !data) return <p className="p-8 text-red-600">Status unavailable.</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Workflow phase: <span className="font-medium">{data.phase}</span>
      </p>

      {data.nodes.length === 0 ? (
        <p className="text-sm text-gray-400">No steps yet.</p>
      ) : (
        <ul className="space-y-1">
          {data.nodes.map((n) => (
            <StepRow key={n.id} node={n} />
          ))}
        </ul>
      )}
    </div>
  )
}

function StepRow({ node }: { node: WorkflowNode }) {
  const icon = PHASE_ICON[node.phase] ?? '·'
  if (node.failed) {
    return (
      <li
        role="alert"
        className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800"
      >
        <div className="flex gap-2 font-medium">
          <span>{icon}</span>
          <span>{node.display_name}</span>
          <span className="text-red-500">({node.phase})</span>
        </div>
        {node.message && <p className="mt-1 text-red-700">{node.message}</p>}
      </li>
    )
  }
  return (
    <li className="flex gap-2 p-2 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span>{node.display_name}</span>
      <span className="text-gray-400">({node.phase})</span>
    </li>
  )
}
