import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGroups, importGroups, type Group } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from './table'

const COLUMNS: Column<Group>[] = [
  { key: 'name', header: 'Name', cell: (g) => <span className="font-medium">{g.name}</span> },
  { key: 'source', header: 'Source', cell: (g) => g.source },
  { key: 'description', header: 'Description', cell: (g) => g.description || '—' },
]

// Local groups registry (F3): list groups + import from pasted or uploaded
// JSON/CSV. The BFF upserts by name (idempotent) and returns {imported, skipped}.
export function AdminGroups() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-groups'], queryFn: fetchGroups })

  const [text, setText] = useState('')
  const [format, setFormat] = useState<'json' | 'csv'>('json')

  const doImport = useMutation({
    mutationFn: () => importGroups(text, format),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-groups'] }),
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setText(await file.text())
    if (file.name.endsWith('.csv')) setFormat('csv')
    else if (file.name.endsWith('.json')) setFormat('json')
  }

  return (
    <section aria-labelledby="groups-heading" className="space-y-4">
      <h2 id="groups-heading" className="text-lg font-semibold tracking-tight">
        Groups
      </h2>

      <form
        className="space-y-2 rounded-lg border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          doImport.mutate()
        }}
      >
        <h3 className="text-sm font-medium">Import groups</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">Format</span>
            <select
              aria-label="Import format"
              className="rounded-md border border-border bg-background px-2 py-1"
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </label>
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            aria-label="Upload groups file"
            onChange={handleFile}
            className="text-sm"
          />
        </div>
        <textarea
          aria-label="Groups to import"
          className="h-28 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
          placeholder={'["team-a", "team-b"]  or  name,description\\nteam-a,A'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={doImport.isPending || !text.trim()}>
          Import
        </Button>
        {doImport.isSuccess && (
          <p role="status" className="text-sm text-success">
            Imported {doImport.data.imported}, skipped {doImport.data.skipped}.
          </p>
        )}
        {doImport.isError && (
          <p role="alert" className="text-sm text-destructive">
            Import failed — check the format and try again.
          </p>
        )}
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load groups.</p>}
      {data && (
        <DataTable
          caption="Local groups registry"
          columns={COLUMNS}
          rows={data.items}
          rowKey={(g) => g.id}
          empty="No groups yet. Import some above."
        />
      )}
    </section>
  )
}
