import { useQuery } from '@tanstack/react-query'
import { fetchOptionSources, type OptionSourceHealth } from '@/lib/admin'
import { DataTable, type Column } from './table'

const COLUMNS: Column<OptionSourceHealth>[] = [
  { key: 'url', header: 'URL', cell: (s) => `${s.method} ${s.url}` },
  {
    key: 'status',
    header: 'Status',
    cell: (s) => (
      <span className={s.stale ? 'text-red-700' : 'text-green-700'}>{s.last_status}</span>
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
    <section aria-labelledby="option-sources-heading" className="space-y-3">
      <h2 id="option-sources-heading" className="text-xl font-semibold">
        Option sources
      </h2>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load option sources.</p>}
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
