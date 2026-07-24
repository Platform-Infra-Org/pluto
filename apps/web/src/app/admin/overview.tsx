import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOverview } from '@/lib/admin'

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

export function AdminOverview() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-overview'], queryFn: fetchOverview })
  if (isLoading) return <p>Loading…</p>
  if (isError || !data) return <p className="text-red-600">Failed to load overview.</p>

  const byState = data.requests_by_state
  const pending = byState.PENDING_APPROVAL ?? 0
  const rate = data.workflow_success_rate
  return (
    <section aria-labelledby="overview-heading" className="space-y-3">
      <h2 id="overview-heading" className="text-xl font-semibold">
        Overview
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Tile label="Pending approval" value={pending} />
        <Tile label="Pending onboarding" value={data.pending_onboarding} />
        <Tile
          label="Workflow success rate"
          value={rate === null ? '—' : `${Math.round(rate * 100)}%`}
        />
        <Tile label="Stale option sources" value={data.option_source_staleness} />
        <Tile label="Invalid catalog files" value={data.invalid_catalog_files} />
        <Tile
          label="Requests total"
          value={Object.values(byState).reduce((a, b) => a + b, 0)}
        />
      </div>
    </section>
  )
}
