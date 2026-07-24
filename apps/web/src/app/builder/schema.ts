import type { FieldSpec, JsonSchema, UiSchema } from '@/app/forms/SchemaForm'

// The builder's field model and the pure functions that turn it into the
// interchange format: a JSON Schema (+ ui-schema) — the SAME schema the BFF
// validates against and the SAME renderer requesters use. Author once.

export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'groups' | 'upload' | 'options'

// The three server-backed field types render via a ui:widget of the same name.
export const SERVER_BACKED: FieldType[] = ['groups', 'upload', 'options']

export interface BuilderField {
  key: string
  label?: string
  type: FieldType
  required?: boolean
  enumValues?: string[]
  help?: string
}

export function buildSchema(fields: BuilderField[]): JsonSchema {
  const properties: Record<string, FieldSpec> = {}
  const required: string[] = []
  for (const f of fields) {
    if (!f.key) continue
    const spec: FieldSpec = { title: f.label || f.key }
    if (f.type === 'number') spec.type = 'number'
    else if (f.type === 'boolean') spec.type = 'boolean'
    else if (f.type === 'enum') {
      spec.type = 'string'
      spec.enum = f.enumValues ?? []
    } else spec.type = 'string' // string, groups, upload, options all store strings
    properties[f.key] = spec
    if (f.required) required.push(f.key)
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) } as JsonSchema
}

export function buildUiSchema(fields: BuilderField[]): UiSchema {
  const ui: UiSchema = {}
  for (const f of fields) {
    const entry: UiSchema[string] = {}
    if (SERVER_BACKED.includes(f.type)) entry['ui:widget'] = f.type
    if (f.help) entry['ui:help'] = f.help
    if (Object.keys(entry).length) ui[f.key] = entry
  }
  return ui
}

export type PolicyMode = 'SINGLE' | 'N_OF_M' | 'RBAC'
export interface ApprovalPolicy {
  mode: PolicyMode
  n?: number
}
export interface WorkflowBinding {
  create?: { template_ref: string; param_map: Record<string, string> }
}
