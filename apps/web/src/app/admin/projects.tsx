import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProject, fetchGroups, fetchProjects, type Project } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type Column } from './table'

const COLUMNS: Column<Project>[] = [
  { key: 'name', header: 'Name', cell: (p) => <span className="font-medium">{p.name}</span> },
  { key: 'group', header: 'Mapped group', cell: (p) => <code className="text-xs">{p.group_name}</code> },
  { key: 'description', header: 'Description', cell: (p) => p.description || '—' },
]

// Projects (F3): list projects and the group each maps to, plus a create form.
// The group box is populated from the registry but allows free entry too, since
// projects may map to LDAP-native groups not tracked locally.
export function AdminProjects() {
  const qc = useQueryClient()
  const projects = useQuery({ queryKey: ['admin-projects'], queryFn: fetchProjects })
  const groups = useQuery({ queryKey: ['admin-groups'], queryFn: fetchGroups })

  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [description, setDescription] = useState('')

  const create = useMutation({
    mutationFn: () =>
      createProject({ name, group_name: group, description: description || undefined }),
    onSuccess: () => {
      setName('')
      setGroup('')
      setDescription('')
      qc.invalidateQueries({ queryKey: ['admin-projects'] })
    },
  })

  return (
    <section aria-labelledby="projects-heading" className="space-y-4">
      <h2 id="projects-heading" className="text-lg font-semibold tracking-tight">
        Projects
      </h2>

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() && group.trim()) create.mutate()
        }}
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input className="w-44" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Group</span>
          {/* free-entry text with registry suggestions via <datalist> */}
          <Input
            className="w-44"
            list="admin-groups-list"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            required
          />
          <datalist id="admin-groups-list">
            {(groups.data?.items ?? []).map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <Input
            className="w-56"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={create.isPending || !name.trim() || !group.trim()}>
          Create
        </Button>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            Create failed — the name may already exist.
          </p>
        )}
      </form>

      {projects.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {projects.isError && <p className="text-sm text-destructive">Failed to load projects.</p>}
      {projects.data && (
        <DataTable
          caption="Projects and their mapped groups"
          columns={COLUMNS}
          rows={projects.data.items}
          rowKey={(p) => p.id}
          empty="No projects yet."
        />
      )}
    </section>
  )
}
