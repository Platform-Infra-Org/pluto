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
