import { useQuery } from '@tanstack/react-query'
import { fetchOptionSources, type OptionSourceHealth } from '@/lib/admin'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from './table'

const COLUMNS: Column<OptionSourceHealth>[] = [
  { key: 'url', header: 'URL', cell: (s) => <code className="text-xs">{s.method} {s.url}</code> },
  {
    key: 'status',
    header: 'Status',
    cell: (s) => (
      <Badge variant={s.stale ? 'destructive' : 'success'}>{s.last_status}</Badge>
    ),
  },
  { key: 'synced', header: 'Last sync', cell: (s) => s.last_synced_at ?? 'never' },
  { key: 'interval', header: 'Interval (s)', cell: (s) => s.refresh_interval },
]

// Option-source poller health: last sync + stale flag (E09 Task 2, from E08).
export function AdminOptionSources() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-option-sources'],
    queryFn: fetchOptionSources,
  })
  return (
    <section aria-labelledby="option-sources-heading" className="space-y-4">
      <h2 id="option-sources-heading" className="text-lg font-semibold tracking-tight">
        Option sources
      </h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load option sources.</p>}
      {data && (
        <DataTable
          caption="Dynamic-choice option source poller health"
          columns={COLUMNS}
          rows={data.items}
          rowKey={(s) => s.id}
          empty="No option sources configured."
        />
      )}
    </section>
  )
}
