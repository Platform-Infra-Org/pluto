import { useEffect, useState } from 'react'
import { generate, type Generated, type GraphsJson } from '@/lib/graph'
import { Card } from '@/components/ui/card'

// Live preview: on a (debounced) graph change, POST to the generate endpoint and
// render the returned build-json.j2 + WorkflowTemplate — or the validation errors.
// Generation is always server-side (CB02); the browser never emits YAML itself.
export function GraphPreview({ graphs, debounceMs = 400 }: { graphs: GraphsJson; debounceMs?: number }) {
  const [result, setResult] = useState<Generated | null>(null)
  const [netError, setNetError] = useState<string | null>(null)
  const key = JSON.stringify(graphs)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      generate(graphs)
        .then((g) => !cancelled && (setResult(g), setNetError(null)))
        .catch((e) => !cancelled && setNetError((e as Error).message))
    }, debounceMs)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // key captures the graph; deps intentionally exclude `graphs` object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, debounceMs])

  const errors = result?.errors ?? []
  const codeClass = 'max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre'

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">Generated preview</h2>
      {netError && (
        <p role="alert" className="text-sm text-destructive">
          {netError}
        </p>
      )}
      {errors.length > 0 ? (
        <Card role="alert" className="space-y-1 border-destructive p-3">
          <div className="text-sm font-medium text-destructive">Invalid graph — fix before generating:</div>
          <ul className="list-disc pl-5 text-sm text-destructive">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Card>
      ) : result ? (
        <>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">build-json.j2</div>
            <pre className={codeClass}>{result.build_json_j2}</pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">WorkflowTemplate</div>
            <pre className={codeClass}>{result.workflow_template_yaml}</pre>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Compose a graph to see the generated output.</p>
      )}
    </div>
  )
}
