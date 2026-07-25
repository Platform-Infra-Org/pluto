import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { AdminOverview } from './overview'
import { AdminRequests } from './requests'
import { AdminServices } from './services'
import { AdminWorkflows } from './workflows'
import { AdminRbac } from './rbac'
import { AdminOptionSources } from './option-sources'
import { AdminGroups } from './groups'
import { AdminProjects } from './projects'

const PANELS = {
  overview: { label: 'Overview', render: () => <AdminOverview /> },
  requests: { label: 'Requests', render: () => <AdminRequests /> },
  services: { label: 'Services', render: () => <AdminServices /> },
  projects: { label: 'Projects', render: () => <AdminProjects /> },
  groups: { label: 'Groups', render: () => <AdminGroups /> },
  workflows: { label: 'Workflows', render: () => <AdminWorkflows /> },
  rbac: { label: 'RBAC & ownership', render: () => <AdminRbac /> },
  'option-sources': { label: 'Option sources', render: () => <AdminOptionSources /> },
} as const

type PanelKey = keyof typeof PANELS

// Admin dashboard shell (E09 Task 2b). The BFF enforces platform-admin on every
// /api/admin/* call; this guard is display-only — a non-admin sees nothing to
// hit those endpoints with.
export function AdminDashboard() {
  const { hasRole, isLoading } = useAuth()
  const [panel, setPanel] = useState<PanelKey>('overview')

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 text-muted-foreground">Loading…</div>
  if (!hasRole('platform-admin'))
    return (
      <div className="mx-auto max-w-7xl space-y-2 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p role="alert" className="text-sm text-destructive">
          You need the platform-admin role to view this dashboard.
        </p>
      </div>
    )

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform-wide operations and configuration.</p>
      </div>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-1 border-b border-border pb-2">
        {(Object.keys(PANELS) as PanelKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-current={panel === key ? 'page' : undefined}
            onClick={() => setPanel(key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              panel === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {PANELS[key].label}
          </button>
        ))}
      </nav>
      {PANELS[panel].render()}
    </div>
  )
}
