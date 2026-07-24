import { apiFetch } from './api'

export interface RequestEvent {
  at: string | null
  actor: string
  from_state: string | null
  to_state: string | null
  note: string | null
  flags: string[]
}

export interface ChangeRequest {
  id: number
  kind: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  resource_type: string
  resource_id: number | null
  owner_team: string
  payload: unknown
  requester: string
  state: string
  approval_policy: { mode: string; n?: number }
  approvals: { approver_id: string; at: string; note: string | null }[]
  base_git_sha: string | null
  workflow_ref: string | null
  created_at: string | null
  can_approve: boolean
  events: RequestEvent[]
}

export interface SubmitRequest {
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  resource_type: string
  resource_id?: number | null
  payload: Record<string, unknown>
}

export function submitRequest(body: SubmitRequest) {
  return apiFetch<ChangeRequest>('/requests', { method: 'POST', body: JSON.stringify(body) })
}

export function fetchMyRequests() {
  return apiFetch<{ items: ChangeRequest[] }>('/requests?mine=1')
}

export function fetchQueue() {
  return apiFetch<{ items: ChangeRequest[] }>('/requests?queue=1')
}

export function fetchRequest(id: number) {
  return apiFetch<ChangeRequest>(`/requests/${id}`)
}

export function approveRequest(id: number, body: { note?: string; confirm_stale?: boolean } = {}) {
  return apiFetch<ChangeRequest>(`/requests/${id}/approve`, { method: 'POST', body: JSON.stringify(body) })
}

export function rejectRequest(id: number, body: { note?: string } = {}) {
  return apiFetch<ChangeRequest>(`/requests/${id}/reject`, { method: 'POST', body: JSON.stringify(body) })
}

export interface WorkflowNode {
  id: string
  name: string
  display_name: string
  type: string
  phase: string
  message: string
  children: string[]
  failed: boolean
}

export interface RequestStatus {
  phase: string
  nodes: WorkflowNode[]
  failed_step: { node: string | null; message: string; phase: string } | null
}

export function fetchRequestStatus(id: number) {
  return apiFetch<RequestStatus>(`/requests/${id}/status`)
}
