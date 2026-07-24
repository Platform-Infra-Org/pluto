import { describe, expect, it } from 'vitest'
import type { GraphsJson } from '@/lib/graph'
import { addVerb, definedVerbs, emptyGraph, removeVerb } from './verbs'

const base: GraphsJson = {
  name: 'svc',
  create: { nodes: [], request_fields: {} },
  update: { nodes: [], request_fields: {} },
}

describe('verb tabs', () => {
  it('lists defined verbs in create/update/delete order', () => {
    expect(definedVerbs(base)).toEqual(['create', 'update'])
  })

  it('adds a verb as a second empty graph', () => {
    const g = addVerb(base, 'delete')
    expect(g.delete).toEqual(emptyGraph())
    expect(definedVerbs(g)).toEqual(['create', 'update', 'delete'])
    expect(base.delete).toBeUndefined() // pure
  })

  it('removes a verb', () => {
    const g = removeVerb(base, 'update')
    expect(g.update).toBeUndefined()
    expect(definedVerbs(g)).toEqual(['create'])
  })

  it("can't remove the last verb", () => {
    const one: GraphsJson = { name: 'svc', create: { nodes: [], request_fields: {} } }
    expect(removeVerb(one, 'create')).toEqual(one) // unchanged
    expect(definedVerbs(removeVerb(one, 'create'))).toEqual(['create'])
  })
})
