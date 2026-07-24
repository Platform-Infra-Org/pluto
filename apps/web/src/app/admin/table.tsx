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
  if (rows.length === 0) return <p className="text-gray-500">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left">
            {columns.map((c) => (
              <th key={c.key} scope="col" className="py-2 pr-4 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b last:border-0">
              {columns.map((c) => (
                <td key={c.key} className="py-2 pr-4 align-top">
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
