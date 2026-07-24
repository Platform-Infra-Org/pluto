import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOwnership, fetchRbac, putOwnership } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type Column } from './table'

interface RbacRow {
  group: string
  roles: string
  teams: string
  deny: string
}

const RBAC_COLUMNS: Column<RbacRow>[] = [
  { key: 'group', header: 'Group', cell: (r) => <span className="font-medium">{r.group}</span> },
  { key: 'roles', header: 'Roles', cell: (r) => r.roles || '—' },
  { key: 'teams', header: 'Teams', cell: (r) => r.teams || '—' },
  { key: 'deny', header: 'Deny', cell: (r) => r.deny || '—' },
]

// RBAC role-group map (read-only) + the ownership map editor. Editing ownership
// takes effect in approval routing server-side (E09 Task 2).
export function AdminRbac() {
  const qc = useQueryClient()
  const rbac = useQuery({ queryKey: ['admin-rbac'], queryFn: fetchRbac })
  const ownership = useQuery({ queryKey: ['admin-ownership'], queryFn: fetchOwnership })

  // `edited` is undefined until the admin types; the input then shows their edit,
  // otherwise the server's current value. No effect syncing needed.
  const [edited, setEdited] = useState<string | undefined>(undefined)
  const defaultTeam = edited ?? ownership.data?.default_team ?? ''

  const save = useMutation({
    mutationFn: () =>
      putOwnership({ path_map: ownership.data?.path_map ?? {}, default_team: defaultTeam }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ownership'] }),
  })

  const rows: RbacRow[] = Object.entries(rbac.data?.role_group_map ?? {}).map(([group, v]) => ({
    group,
    roles: (v.roles ?? []).join(', '),
    teams: (v.teams ?? []).join(', '),
    deny: (v.deny ?? []).join(', '),
  }))

  return (
    <section aria-labelledby="rbac-heading" className="space-y-4">
      <h2 id="rbac-heading" className="text-lg font-semibold tracking-tight">
        RBAC &amp; ownership
      </h2>
      <h3 className="text-sm font-medium text-muted-foreground">Role-group map</h3>
      <DataTable
        caption="Group to roles and teams mapping"
        columns={RBAC_COLUMNS}
        rows={rows}
        rowKey={(r) => r.group}
        empty="No mappings configured."
      />
      <h3 className="text-sm font-medium text-muted-foreground">Ownership</h3>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Default owner team</span>
          <Input
            className="w-56"
            value={defaultTeam}
            onChange={(e) => setEdited(e.target.value)}
          />
        </label>
        <Button type="submit">Save</Button>
        {save.isSuccess && <span className="text-sm text-success">Saved.</span>}
      </form>
    </section>
  )
}
