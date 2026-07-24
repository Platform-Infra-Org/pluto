import type { GraphsJson, Verb } from '@/lib/graph'
import { Button } from '@/components/ui/button'
import { addVerb, definedVerbs, removeVerb, VERBS } from './verbs'

// Tabs for each supported verb + add/remove. Each verb owns its own graph; a
// service must keep at least one verb (remove is hidden on the last tab).
export function VerbTabs({
  graphs,
  active,
  onActive,
  onChange,
}: {
  graphs: GraphsJson
  active: Verb
  onActive: (v: Verb) => void
  onChange: (g: GraphsJson) => void
}) {
  const defined = definedVerbs(graphs)
  const addable = VERBS.filter((v) => !graphs[v])

  const remove = (v: Verb) => {
    const next = removeVerb(graphs, v)
    onChange(next)
    if (v === active) onActive(definedVerbs(next)[0])
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
      {defined.map((v) => (
        <div key={v} className="flex items-center">
          <button
            type="button"
            onClick={() => onActive(v)}
            aria-current={v === active ? 'page' : undefined}
            className={
              v === active
                ? 'rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground'
                : 'rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-accent'
            }
          >
            {v}
          </button>
          {defined.length > 1 && (
            <button
              type="button"
              aria-label={`remove ${v}`}
              onClick={() => remove(v)}
              className="px-1 text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {addable.map((v) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant="ghost"
          className="text-primary"
          onClick={() => {
            onChange(addVerb(graphs, v))
            onActive(v)
          }}
        >
          + {v}
        </Button>
      ))}
    </div>
  )
}
