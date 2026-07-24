import { describe, expect, it } from 'vitest'
import { buildSchema, buildUiSchema, type BuilderField } from './schema'

const fields: BuilderField[] = [
  { key: 'engine', label: 'Engine', type: 'string', required: true },
  { key: 'size', type: 'number' },
  { key: 'tier', type: 'enum', enumValues: ['bronze', 'gold'] },
  { key: 'owners', type: 'groups' },
]

describe('buildSchema', () => {
  it('emits a valid JSON Schema with types, required, and enums', () => {
    const s = buildSchema(fields)
    expect(s.type).toBe('object')
    expect(s.properties?.engine).toEqual({ title: 'Engine', type: 'string' })
    expect(s.properties?.size?.type).toBe('number')
    expect(s.properties?.tier).toEqual({ title: 'tier', type: 'string', enum: ['bronze', 'gold'] })
    expect(s.required).toEqual(['engine'])
  })

  it('drops fields without a key and omits an empty required array', () => {
    const s = buildSchema([{ key: '', type: 'string' }, { key: 'x', type: 'string' }])
    expect(Object.keys(s.properties ?? {})).toEqual(['x'])
    expect(s.required).toBeUndefined()
  })

  it('maps server-backed field types to ui:widget hints', () => {
    const ui = buildUiSchema(fields)
    expect(ui.owners).toEqual({ 'ui:widget': 'groups' })
    expect(ui.engine).toBeUndefined() // base types carry no widget
  })
})
