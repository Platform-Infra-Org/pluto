import type { GraphsJson, ServiceGraphJson, Verb } from '@/lib/graph'

// Verbs are opt-in and per-verb independent (design §7): any non-empty subset of
// {create, update, delete}, each holding its own graph. Pure helpers, immutable.
export const VERBS: Verb[] = ['create', 'update', 'delete']

export const emptyGraph = (): ServiceGraphJson => ({ nodes: [], request_fields: {} })

export function definedVerbs(graphs: GraphsJson): Verb[] {
  return VERBS.filter((v) => graphs[v])
}

export function addVerb(graphs: GraphsJson, verb: Verb): GraphsJson {
  return graphs[verb] ? graphs : { ...graphs, [verb]: emptyGraph() }
}

// Remove a verb — but never the last one (a service must support ≥1 verb).
export function removeVerb(graphs: GraphsJson, verb: Verb): GraphsJson {
  if (!graphs[verb] || definedVerbs(graphs).length <= 1) return graphs
  const next = { ...graphs }
  delete next[verb]
  return next
}
