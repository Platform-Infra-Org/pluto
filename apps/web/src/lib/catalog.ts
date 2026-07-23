import { apiFetch } from './api'

export interface ResourceSummary {
  id: number
  type: string
  name: string
  owner_team: string
  git_path: string
  git_sha: string
  status: string
  updated_at: string | null
}

export interface ResourceDetail extends ResourceSummary {
  payload: unknown
}

export interface HistoryEntry {
  sha: string
  author: string
  date: string
  message: string
}

export function fetchResources(params: { type?: string; q?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  if (params.q) qs.set('q', params.q)
  const s = qs.toString()
  return apiFetch<{ items: ResourceSummary[]; page: number }>(`/resources${s ? `?${s}` : ''}`)
}

export function fetchResource(id: number) {
  return apiFetch<ResourceDetail>(`/resources/${id}`)
}

export function fetchHistory(id: number) {
  return apiFetch<HistoryEntry[]>(`/resources/${id}/history`)
}
