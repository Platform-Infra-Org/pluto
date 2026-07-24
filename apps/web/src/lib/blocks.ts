import { apiFetch } from './api'

export interface IOFieldDto {
  name: string
  type: string
  required?: boolean
}

export interface BlockManifestDto {
  name: string
  category: string
  icon: string
  template_ref: string
  entrypoint?: string
  inputs: IOFieldDto[]
  outputs: IOFieldDto[]
  ui: Record<string, unknown>
}

export interface Block {
  name: string
  version: number
  kind: 'function' | 'service'
  manifest: BlockManifestDto
}

export function fetchBlocks() {
  return apiFetch<{ items: Block[] }>('/blocks')
}

// Onboard (upsert) a function block from its manifest YAML. The BFF validates the
// manifest before store and is the authz gate (platform-admin only).
export function onboardBlock(manifest: string) {
  return apiFetch<Block>('/blocks', { method: 'POST', body: JSON.stringify({ manifest }) })
}

// The structured manifest the "new block" form builds — posted as manifest_json so
// platform-admins don't have to hand-write YAML.
export interface BlockFormManifest {
  name: string
  category: string
  icon: string
  template_ref: string // the Argo WorkflowTemplate that runs the block
  entrypoint: string // the template within that WorkflowTemplate (default "run")
  inputs: { name: string; type: string; required: boolean }[]
  outputs: { name: string; type: string }[]
}

export function onboardBlockForm(manifest_json: BlockFormManifest) {
  return apiFetch<Block>('/blocks', { method: 'POST', body: JSON.stringify({ manifest_json }) })
}

// Edit an existing block: PUT upserts a new version (pin-until-migrated).
export function editBlock(manifest_json: BlockFormManifest) {
  return apiFetch<Block>('/blocks', { method: 'PUT', body: JSON.stringify({ manifest_json }) })
}
