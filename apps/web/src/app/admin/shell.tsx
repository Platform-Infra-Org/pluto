import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { AdminOverview } from './overview'
import { AdminRequests } from './requests'
import { AdminServices } from './services'
import { AdminWorkflows } from './workflows'
import { AdminRbac } from './rbac'
import { AdminOptionSources } from './option-sources'

const PANELS = {
  overview: { label: 'Overview', render: () => <AdminOverview /> },
  requests: { label: 'Requests', render: () => <AdminRequests /> },
  services: { label: 'Services', render: () => <AdminServices /> },
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

  if (isLoading) return <div className="p-8">Loading…</div>
  if (!hasRole('platform-admin'))
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p role="alert" className="text-red-700">
          You need the platform-admin role to view this dashboard.
        </p>
      </div>
    )

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-2 border-b pb-2">
        {(Object.keys(PANELS) as PanelKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-current={panel === key ? 'page' : undefined}
            onClick={() => setPanel(key)}
            className={`rounded px-3 py-1 ${
              panel === key ? 'bg-blue-700 text-white' : 'bg-gray-100'
            }`}
          >
            {PANELS[key].label}
          </button>
        ))}
      </nav>
      {PANELS[panel].render()}
    </div>
  )
}
