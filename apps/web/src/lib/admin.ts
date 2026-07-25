import { apiFetch } from './api'

// Admin dashboard API client (E09 Task 2b). Every call hits an /api/admin/*
// endpoint the BFF gates with require_role("platform-admin") — this client is
// only reachable behind the display-only admin route guard.

export interface Overview {
  requests_by_state: Record<string, number>
  pending_onboarding: number
  workflow_success_rate: number | null
  option_source_staleness: number
  invalid_catalog_files: number
}

export interface AdminRequest {
  id: number
  kind: string
  action: string
  resource_type: string
  owner_team: string
  requester: string
  state: string
  workflow_ref: string | null
  failure: { node: string | null; message: string; phase: string } | null
  created_at: string | null
}

export interface AdminDefinition {
  id: number
  name: string
  owner_team: string
  status: string
  version: number
  category: string
}

export interface OptionSourceHealth {
  id: number
  url: string
  method: string
  last_status: string
  stale: boolean
  last_synced_at: string | null
  refresh_interval: number
}

export interface Ownership {
  path_map: Record<string, string>
  default_team: string
}

export const fetchOverview = () => apiFetch<Overview>('/admin/overview')

export function fetchAdminRequests(filters: { state?: string; team?: string; kind?: string } = {}) {
  const q = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString()
  return apiFetch<{ items: AdminRequest[] }>(`/admin/requests${q ? `?${q}` : ''}`)
}

export const fetchAdminServices = () =>
  apiFetch<{ definitions: AdminDefinition[]; onboarding_queue: AdminRequest[] }>('/admin/services')

export const fetchAdminWorkflows = () => apiFetch<{ items: AdminRequest[] }>('/admin/workflows')

export const fetchRbac = () =>
  apiFetch<{ role_group_map: Record<string, { roles?: string[]; teams?: string[]; deny?: string[] }> }>(
    '/admin/rbac',
  )

export const fetchOwnership = () => apiFetch<Ownership>('/admin/ownership')

export const putOwnership = (body: Ownership) =>
  apiFetch<Ownership>('/admin/ownership', { method: 'PUT', body: JSON.stringify(body) })

export const fetchOptionSources = () =>
  apiFetch<{ items: OptionSourceHealth[] }>('/admin/option-sources')

// --- F3: local groups registry (import) + projects mapped to a group --------

export interface Group {
  id: number
  name: string
  source: string
  description: string | null
}

export interface Project {
  id: number
  name: string
  group_name: string
  description: string | null
}

export const fetchGroups = () => apiFetch<{ items: Group[] }>('/admin/groups')

// Import body is raw JSON or CSV text (not a JSON envelope); the server reads
// the raw body and picks the parser from `format`.
export const importGroups = (body: string, format: 'json' | 'csv') =>
  apiFetch<{ imported: number; skipped: number }>(`/admin/groups/import?format=${format}`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'text/plain' },
  })

export const fetchProjects = () => apiFetch<{ items: Project[] }>('/admin/projects')

export const createProject = (body: { name: string; group_name: string; description?: string }) =>
  apiFetch<Project & { group_known: boolean }>('/admin/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const approveOnboarding = (id: number, note?: string) =>
  apiFetch<{ state: string; definition_status: string | null }>(
    `/admin/services/onboarding/${id}/approve`,
    { method: 'POST', body: JSON.stringify({ note }) },
  )

export const rejectOnboarding = (id: number, note?: string) =>
  apiFetch<{ state: string; definition_status: string | null }>(
    `/admin/services/onboarding/${id}/reject`,
    { method: 'POST', body: JSON.stringify({ note }) },
  )
