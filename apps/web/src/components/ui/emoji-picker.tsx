import { useState } from 'react'
import { cn } from '@/lib/utils'

// A small curated emoji set (infra/service flavoured + general), each with search
// keywords, so the block "icon" is picked like a normal emoji picker — no dependency.
const EMOJIS: { e: string; k: string }[] = [
  { e: '📦', k: 'box package build artifact' },
  { e: '🗄️', k: 'database db archive cabinet store' },
  { e: '🗃️', k: 'index cards records store' },
  { e: '💾', k: 'save disk storage floppy' },
  { e: '🗂️', k: 'files folders index' },
  { e: '📁', k: 'folder directory' },
  { e: '☁️', k: 'cloud infra' },
  { e: '🌐', k: 'network globe web http api' },
  { e: '🔌', k: 'plug connect integration' },
  { e: '🔗', k: 'link chain url ref' },
  { e: '📡', k: 'signal broadcast stream events antenna' },
  { e: '🛰️', k: 'satellite remote' },
  { e: '🚀', k: 'rocket deploy launch ship' },
  { e: '🐳', k: 'docker whale container' },
  { e: '⚙️', k: 'gear settings config engine' },
  { e: '🔧', k: 'wrench tool fix' },
  { e: '🛠️', k: 'tools build maintain' },
  { e: '🧰', k: 'toolbox kit' },
  { e: '🧩', k: 'plugin puzzle piece block module' },
  { e: '🔒', k: 'lock secret secure secret secret' },
  { e: '🔑', k: 'key secret credential auth token' },
  { e: '🛡️', k: 'shield security guard rbac' },
  { e: '🔔', k: 'bell notify notification alert' },
  { e: '📣', k: 'announce broadcast slack notify' },
  { e: '✉️', k: 'email mail message send' },
  { e: '📊', k: 'chart metrics analytics dashboard bar' },
  { e: '📈', k: 'graph trend metrics up' },
  { e: '🔍', k: 'search find query extract magnify' },
  { e: '🧪', k: 'test lab experiment' },
  { e: '⚡', k: 'fast trigger event bolt run' },
  { e: '🔥', k: 'hot fire' },
  { e: '🖥️', k: 'server computer host machine' },
  { e: '💻', k: 'laptop dev' },
  { e: '📜', k: 'script log yaml template' },
  { e: '📝', k: 'form edit note request' },
  { e: '✅', k: 'approve check done ok' },
  { e: '⛔', k: 'deny block stop' },
  { e: '♻️', k: 'workflow recycle retry' },
  { e: '🌱', k: 'create new seed provision' },
  { e: '🗑️', k: 'delete trash remove' },
  { e: '🏷️', k: 'tag label' },
  { e: '👥', k: 'team group users' },
  { e: '🧱', k: 'block brick build' },
  { e: '🧠', k: 'ai brain logic' },
  { e: '🌀', k: 'jinja render spiral transform' },
  { e: '🔁', k: 'loop repeat sync' },
  { e: '📮', k: 'queue outbox send' },
  { e: '🪣', k: 'bucket s3 storage' },
  { e: '🔨', k: 'hammer build' },
  { e: '🧯', k: 'incident fix' },
]

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = needle ? EMOJIS.filter((x) => x.k.includes(needle) || x.e === needle) : EMOJIS

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-16 items-center justify-center rounded-md border border-input bg-transparent text-lg shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span aria-hidden>{value || '📦'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            aria-label="Choose an icon"
            className="absolute left-0 z-20 mt-2 w-64 rounded-lg border border-border bg-popover p-2 shadow-md"
          >
            <input
              aria-label="search icons"
              autoFocus
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-2 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="grid max-h-56 grid-cols-8 gap-1 overflow-auto">
              {shown.map((x) => (
                <button
                  key={x.e}
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === x.e}
                  aria-label={x.k.split(' ')[0]}
                  title={x.k.split(' ')[0]}
                  onClick={() => {
                    onChange(x.e)
                    setOpen(false)
                    setQ('')
                  }}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-accent',
                    value === x.e && 'ring-2 ring-ring',
                  )}
                >
                  <span aria-hidden>{x.e}</span>
                </button>
              ))}
              {shown.length === 0 && (
                <span className="col-span-8 py-2 text-center text-xs text-muted-foreground">No matches</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
