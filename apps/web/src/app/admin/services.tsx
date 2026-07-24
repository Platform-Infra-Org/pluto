import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveOnboarding,
  fetchAdminServices,
  rejectOnboarding,
  type AdminDefinition,
  type AdminRequest,
} from '@/lib/admin'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { DataTable, type Column } from './table'

const DEF_COLUMNS: Column<AdminDefinition>[] = [
  { key: 'name', header: 'Name', cell: (d) => <span className="font-medium">{d.name}</span> },
  { key: 'team', header: 'Team', cell: (d) => d.owner_team },
  { key: 'version', header: 'Version', cell: (d) => `v${d.version}` },
  { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
]

function OnboardingRow({ item, onDone }: { item: AdminRequest; onDone: () => void }) {
  const [note, setNote] = useState('')
  const approve = useMutation({ mutationFn: () => approveOnboarding(item.id, note), onSuccess: onDone })
  const reject = useMutation({ mutationFn: () => rejectOnboarding(item.id, note), onSuccess: onDone })
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <span className="font-medium">
          #{item.id} {item.resource_type}
        </span>
        <span className="text-sm text-muted-foreground">by {item.requester}</span>
        <Input
          aria-label={`review note for onboarding ${item.id}`}
          placeholder="note"
          className="min-w-40 flex-1"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="button" variant="success" size="sm" onClick={() => approve.mutate()}>
          Approve
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => reject.mutate()}>
          Reject
        </Button>
      </Card>
    </li>
  )
}

// All Service Definitions + the onboarding queue, with approve/reject in place.
export function AdminServices() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-services'],
    queryFn: fetchAdminServices,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-services'] })
  return (
    <section aria-labelledby="services-heading" className="space-y-4">
      <h2 id="services-heading" className="text-lg font-semibold tracking-tight">
        Services
      </h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load services.</p>}
      {data && (
        <>
          <h3 className="text-sm font-medium text-muted-foreground">Onboarding queue</h3>
          {data.onboarding_queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            <ul className="space-y-2">
              {data.onboarding_queue.map((i) => (
                <OnboardingRow key={i.id} item={i} onDone={refresh} />
              ))}
            </ul>
          )}
          <h3 className="text-sm font-medium text-muted-foreground">Definitions</h3>
          <DataTable
            caption="All service definitions"
            columns={DEF_COLUMNS}
            rows={data.definitions}
            rowKey={(d) => d.id}
            empty="No definitions."
          />
        </>
      )}
    </section>
  )
}
