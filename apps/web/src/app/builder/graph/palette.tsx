import { useQuery } from '@tanstack/react-query'
import { fetchBlocks, type Block } from '@/lib/blocks'
import { Card } from '@/components/ui/card'

// Left palette: function blocks + ACTIVE service blocks (dependencies) from
// /api/blocks, each with its typed ports. Drag onto the canvas (RF drop) or click
// to add. The DRAG_MIME payload is the block name the canvas turns into a node.
export const DRAG_MIME = 'application/x-block'

function ports(fields: { name: string; type: string; required?: boolean }[]) {
  return fields.map((f) => `${f.name}: ${f.type}${f.required ? '' : '?'}`).join(', ') || '—'
}

function PaletteItem({ block, onAdd }: { block: Block; onAdd: (b: Block) => void }) {
  const m = block.manifest
  return (
    <li>
      <Card
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, block.name)}
        onClick={() => onAdd(block)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onAdd(block)}
        className="cursor-grab space-y-1 p-3 text-sm hover:border-primary"
      >
        <div className="font-medium">
          {block.name}
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {block.kind}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">in: {ports(m.inputs)}</div>
        <div className="text-xs text-muted-foreground">out: {ports(m.outputs)}</div>
      </Card>
    </li>
  )
}

export function Palette({ onAdd }: { onAdd: (b: Block) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['blocks'], queryFn: fetchBlocks })
  const items = data?.items ?? []
  const fns = items.filter((b) => b.kind === 'function')
  const svcs = items.filter((b) => b.kind === 'service')

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">Blocks</h2>
      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {fns.length > 0 && (
        <ul className="space-y-2">
          {fns.map((b) => (
            <PaletteItem key={b.name} block={b} onAdd={onAdd} />
          ))}
        </ul>
      )}
      {svcs.length > 0 && (
        <>
          <h3 className="text-xs font-medium text-muted-foreground">Services (dependencies)</h3>
          <ul className="space-y-2">
            {svcs.map((b) => (
              <PaletteItem key={b.name} block={b} onAdd={onAdd} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
