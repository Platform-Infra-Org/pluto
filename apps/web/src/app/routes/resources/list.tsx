import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { fetchResources } from '@/lib/catalog'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

// My Resources — RBAC/ownership filtering is enforced by the BFF; this list only
// renders what the caller is allowed to see, plus a client-side text filter.
export function ResourceList() {
  const [filter, setFilter] = useState('')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['resources'],
    queryFn: () => fetchResources(),
  })

  const items = data?.items ?? []
  const needle = filter.toLowerCase()
  const shown = items.filter((r) =>
    `${r.name} ${r.type} ${r.owner_team} ${r.status}`.toLowerCase().includes(needle),
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Resources</h1>
          <p className="text-sm text-muted-foreground">Catalog resources you own or can view.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter resources…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Link
            to="/requests/new"
            search={{ type: '', action: 'CREATE', resourceId: 0 }}
            className={buttonVariants() + ' shrink-0'}
          >
            <Plus className="h-4 w-4" /> New request
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load resources.</p>}
      {!isLoading && !isError && (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Owner team</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((r) => (
                <TR key={r.id}>
                  <TD>
                    {/* client-side nav — a full-page anchor would reload the SPA and drop the in-memory token */}
                    <Link
                      to="/resources/$resourceId"
                      params={{ resourceId: String(r.id) }}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{r.type}</TD>
                  <TD className="text-muted-foreground">{r.owner_team}</TD>
                  <TD>
                    <StatusBadge status={r.status} />
                  </TD>
                </TR>
              ))}
              {shown.length === 0 && (
                <TR className="hover:bg-transparent">
                  <TD className="py-8 text-center text-muted-foreground" colSpan={4}>
                    No resources match your filter.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
