import { apiFetch } from './api'
import type { JsonSchema, UiSchema } from '@/app/forms/SchemaForm'
import type { ApprovalPolicy, WorkflowBinding } from '@/app/builder/schema'

export interface ServiceDefinition {
  id: number
  name: string
  category: string
  owner_team: string
  form_schema: JsonSchema
  ui_schema: UiSchema
  workflow_binding: WorkflowBinding
  approval_policy: ApprovalPolicy
  git_path: string
  status: 'DRAFT' | 'PENDING_ONBOARDING' | 'ACTIVE' | 'RETIRED'
  version: number
  // CB04: the regenerated artifacts printed for the platform team to commit to Git.
  generated?: { build_json_j2: string; workflow_template_yaml: string }
}

export interface NewDefinition {
  name: string
  category?: string
  owner_team?: string
  form_schema: JsonSchema
  ui_schema: UiSchema
  workflow_binding: WorkflowBinding
  approval_policy: ApprovalPolicy
}

export function createDefinition(body: NewDefinition) {
  return apiFetch<ServiceDefinition>('/services/definitions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function submitDefinition(id: number) {
  return apiFetch<{ request_id: number; state: string }>(`/services/definitions/${id}/submit`, {
    method: 'POST',
  })
}

// CB04: save the composed per-verb graphs (regenerate on the BFF) and re-enter
// onboarding. A non-DRAFT definition forks a new bumped version (pin-until-migrated).
export function editDefinition(id: number, graphs: unknown) {
  return apiFetch<{ version: number; request_id: number; definition: ServiceDefinition }>(
    `/services/definitions/${id}/edit`,
    { method: 'POST', body: JSON.stringify({ graphs }) },
  )
}

export function fetchMyDefinitions() {
  return apiFetch<{ items: ServiceDefinition[] }>('/services/definitions?mine=1')
}

// Resource types available to request = every ACTIVE ServiceDefinition (any team).
// Populates the "New request" type picker, so an approved onboarding is immediately
// requestable even before any resource of that type exists.
export interface AvailableType {
  name: string
  category: string
  owner_team: string
}

export function fetchAvailableTypes() {
  return apiFetch<{ items: AvailableType[] }>('/services/available')
}

export interface OnboardingItem {
  request_id: number
  requester: string
  state: string
  definition: ServiceDefinition | null
}

export function fetchOnboardingQueue() {
  return apiFetch<{ items: OnboardingItem[] }>('/services/onboarding')
}

export function approveOnboarding(id: number, note?: string) {
  return apiFetch<{ state: string; definition_status: string | null }>(
    `/services/onboarding/${id}/approve`,
    { method: 'POST', body: JSON.stringify({ note }) },
  )
}

export function rejectOnboarding(id: number, note?: string) {
  return apiFetch<{ state: string; definition_status: string | null }>(
    `/services/onboarding/${id}/reject`,
    { method: 'POST', body: JSON.stringify({ note }) },
  )
}
