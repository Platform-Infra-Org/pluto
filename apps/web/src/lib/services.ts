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

export function fetchMyDefinitions() {
  return apiFetch<{ items: ServiceDefinition[] }>('/services/definitions?mine=1')
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
