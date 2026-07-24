import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveOnboarding,
  fetchAdminServices,
  rejectOnboarding,
  type AdminDefinition,
  type AdminRequest,
} from '@/lib/admin'
import { DataTable, type Column } from './table'

const DEF_COLUMNS: Column<AdminDefinition>[] = [
  { key: 'name', header: 'Name', cell: (d) => d.name },
  { key: 'team', header: 'Team', cell: (d) => d.owner_team },
  { key: 'version', header: 'Version', cell: (d) => `v${d.version}` },
  { key: 'status', header: 'Status', cell: (d) => d.status },
]

function OnboardingRow({ item, onDone }: { item: AdminRequest; onDone: () => void }) {
  const [note, setNote] = useState('')
  const approve = useMutation({ mutationFn: () => approveOnboarding(item.id, note), onSuccess: onDone })
  const reject = useMutation({ mutationFn: () => rejectOnboarding(item.id, note), onSuccess: onDone })
  return (
    <li className="border rounded p-3 flex flex-wrap items-center gap-2">
      <span className="font-medium">
        #{item.id} {item.resource_type}
      </span>
      <span className="text-sm text-gray-500">by {item.requester}</span>
      <input
        aria-label={`review note for onboarding ${item.id}`}
        placeholder="note"
        className="border rounded px-2 py-1 flex-1 min-w-40"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="button" className="bg-green-700 text-white rounded px-3 py-1" onClick={() => approve.mutate()}>
        Approve
      </button>
      <button type="button" className="bg-red-600 text-white rounded px-3 py-1" onClick={() => reject.mutate()}>
        Reject
      </button>
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
      <h2 id="services-heading" className="text-xl font-semibold">
        Services
      </h2>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load services.</p>}
      {data && (
        <>
          <h3 className="font-medium">Onboarding queue</h3>
          {data.onboarding_queue.length === 0 ? (
            <p className="text-gray-500">Nothing pending.</p>
          ) : (
            <ul className="space-y-2">
              {data.onboarding_queue.map((i) => (
                <OnboardingRow key={i.id} item={i} onDone={refresh} />
              ))}
            </ul>
          )}
          <h3 className="font-medium">Definitions</h3>
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
