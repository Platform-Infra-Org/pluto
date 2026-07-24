import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SchemaForm } from '@/app/forms/SchemaForm'
import { approveOnboarding, fetchOnboardingQueue, rejectOnboarding, type OnboardingItem } from '@/lib/services'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Admin onboarding queue: each pending request shows the form preview, the
// workflow binding + parameter map, and the approval policy, with approve/reject.
function QueueRow({ item, onDone }: { item: OnboardingItem; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [value, setValue] = useState<Record<string, unknown>>({})
  const approve = useMutation({ mutationFn: () => approveOnboarding(item.request_id, note), onSuccess: onDone })
  const reject = useMutation({ mutationFn: () => rejectOnboarding(item.request_id, note), onSuccess: onDone })
  const d = item.definition
  return (
    <li>
      <Card className="space-y-3 p-4">
        <div className="font-medium">
          #{item.request_id} {d?.name} <span className="text-muted-foreground">v{d?.version}</span>
          <span className="ml-2 text-sm text-muted-foreground">by {item.requester}</span>
        </div>
        {d && (
          <>
            <div className="text-sm text-muted-foreground">
              Binding: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{d.workflow_binding?.create?.template_ref || '—'}</code>
              {'  ·  '}
              Policy: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{d.approval_policy?.mode}{d.approval_policy?.n ? `(${d.approval_policy.n})` : ''}</code>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <SchemaForm schema={d.form_schema} uiSchema={d.ui_schema} value={value} onChange={setValue} />
            </div>
          </>
        )}
        <Input
          aria-label="review note"
          placeholder="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="success" onClick={() => approve.mutate()}>
            Approve
          </Button>
          <Button type="button" variant="destructive" onClick={() => reject.mutate()}>
            Reject
          </Button>
        </div>
      </Card>
    </li>
  )
}

export function OnboardingQueue() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['onboarding-queue'],
    queryFn: fetchOnboardingQueue,
  })
  const items = data?.items ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['onboarding-queue'] })
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding Queue</h1>
        <p className="text-sm text-muted-foreground">Service definitions awaiting review.</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load the queue.</p>}
      {!isLoading && items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nothing pending.</Card>
      )}
      <ul className="space-y-4">
        {items.map((i) => (
          <QueueRow key={i.request_id} item={i} onDone={refresh} />
        ))}
      </ul>
    </div>
  )
}
