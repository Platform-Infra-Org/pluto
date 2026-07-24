import type { ReactNode } from 'react'

// Accessible data grid used across the admin panels (E09 Task 5): a real
// <table> with a caption and column-scoped headers so screen readers announce
// structure and cells, and keyboard focus follows normal document order.
export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty = 'Nothing to show.',
}: {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  empty?: string
}) {
  if (rows.length === 0)
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-border transition-colors last:border-0 hover:bg-muted/50">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 align-top">
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
