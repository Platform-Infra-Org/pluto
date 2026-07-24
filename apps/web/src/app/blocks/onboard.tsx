import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { fetchBlocks, onboardBlock, type Block } from '@/lib/blocks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// One row per registered block: its kind + template ref + typed IO. This is the
// palette CB02/CB03 build on, so surfacing the types here is the whole point.
function BlockRow({ block }: { block: Block }) {
  const m = block.manifest
  const io = (fields: { name: string; type: string; required?: boolean }[]) =>
    fields.map((f) => `${f.name}: ${f.type}${f.required ? '' : '?'}`).join(', ') || '—'
  return (
    <li>
      <Card className="space-y-1 p-4 text-sm">
        <div className="font-medium">
          {block.name} <span className="text-muted-foreground">v{block.version}</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{block.kind}</span>
          <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{m.template_ref}</code>
        </div>
        <div className="text-muted-foreground">in: {io(m.inputs)}</div>
        <div className="text-muted-foreground">out: {io(m.outputs)}</div>
      </Card>
    </li>
  )
}

// Platform block-onboarding screen (design §9): paste a block manifest YAML ->
// validated via POST /api/blocks (the BFF is the authz + validation gate) -> the
// block joins the registry list. Admin-only; the server enforces it too.
export function BlockOnboard() {
  const { hasRole, isLoading } = useAuth()
  const qc = useQueryClient()
  const [manifest, setManifest] = useState('')
  const { data } = useQuery({ queryKey: ['blocks'], queryFn: fetchBlocks })
  const onboard = useMutation({
    mutationFn: () => onboardBlock(manifest),
    onSuccess: () => {
      setManifest('')
      void qc.invalidateQueries({ queryKey: ['blocks'] })
    },
  })

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-8 text-muted-foreground">Loading…</div>
  if (!hasRole('platform-admin'))
    return (
      <div className="mx-auto max-w-4xl space-y-2 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Function Blocks</h1>
        <p role="alert" className="text-sm text-destructive">
          You need the platform-admin role to onboard function blocks.
        </p>
      </div>
    )

  const items = data?.items ?? []
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Function Blocks</h1>
        <p className="text-sm text-muted-foreground">
          Onboard a reusable block from its manifest (YAML). Type system: string · number · boolean ·
          json · enum[…] · map&lt;string,T&gt; · jsonpath · secretRef.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <label htmlFor="manifest" className="text-sm font-medium">
          Block manifest (YAML)
        </label>
        <textarea
          id="manifest"
          aria-label="manifest"
          className="min-h-48 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={'kind: FunctionBlock\nmetadata:\n  name: my-block\n  category: builtin\ntemplate:\n  ref: fn-my-block\ninputs: []\noutputs: []'}
          value={manifest}
          onChange={(e) => setManifest(e.target.value)}
        />
        {onboard.isError && (
          <p role="alert" className="text-sm text-destructive">
            {(onboard.error as Error).message}
          </p>
        )}
        <Button type="button" onClick={() => onboard.mutate()} disabled={!manifest.trim() || onboard.isPending}>
          Onboard block
        </Button>
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-medium">Registered blocks</h2>
        {items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No blocks yet.</Card>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <BlockRow key={`${b.name}-${b.version}`} block={b} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
