import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOverview } from '@/lib/admin'
import { Card } from '@/components/ui/card'

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
    </Card>
  )
}

export function AdminOverview() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-overview'], queryFn: fetchOverview })
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (isError || !data) return <p className="text-sm text-destructive">Failed to load overview.</p>

  const byState = data.requests_by_state
  const pending = byState.PENDING_APPROVAL ?? 0
  const rate = data.workflow_success_rate
  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <h2 id="overview-heading" className="text-lg font-semibold tracking-tight">
        Overview
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Tile label="Pending approval" value={pending} />
        <Tile label="Pending onboarding" value={data.pending_onboarding} />
        <Tile
          label="Workflow success rate"
          value={rate === null ? '—' : `${Math.round(rate * 100)}%`}
        />
        <Tile label="Stale option sources" value={data.option_source_staleness} />
        <Tile label="Invalid catalog files" value={data.invalid_catalog_files} />
        <Tile label="Requests total" value={Object.values(byState).reduce((a, b) => a + b, 0)} />
      </div>
    </section>
  )
}
