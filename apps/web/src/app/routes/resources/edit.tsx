import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchResource } from '@/lib/catalog'
import { submitRequest } from '@/lib/requests'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Edit a resource by hand-editing its full JSON payload. Submitting does NOT
// apply the change — it opens an UPDATE change request routed to the owner team
// for approval (BFF resolves ownership + policy on submit).
export function ResourceEdit({ id }: { id: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => fetchResource(id),
  })
  const [text, setText] = useState<string | null>(null)
  const [parseError, setParseError] = useState('')
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitRequest({ action: 'UPDATE', resource_type: data!.type, resource_id: id, payload }),
  })

  if (isLoading)
    return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">Loading…</p>
  if (isError || !data)
    return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-destructive">Resource not found.</p>

  const value = text ?? JSON.stringify(data.payload, null, 2)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      setParseError('Invalid JSON — fix the syntax and try again.')
      return
    }
    setParseError('')
    mutation.mutate(parsed as Record<string, unknown>)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {data.name}</h1>
        <p className="text-sm text-muted-foreground">
          Editing sends a change request to <span className="font-medium">{data.owner_team}</span> for
          approval — it is not applied immediately.
        </p>
      </div>
      {mutation.isSuccess ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-5 text-sm text-success">
            Edit request #{mutation.data.id} submitted for approval to {mutation.data.owner_team}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Payload (JSON)</span>
                <textarea
                  className="h-80 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
                  value={value}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                />
              </label>
              {parseError && <p className="text-sm text-destructive">{parseError}</p>}
              <Button type="submit" disabled={mutation.isPending}>
                Submit edit for approval
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {mutation.isError && <p className="text-sm text-destructive">Submit failed.</p>}
    </div>
  )
}
