import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchResources } from '@/lib/catalog'
import { fetchAvailableTypes } from '@/lib/services'
import { submitRequest } from '@/lib/requests'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Onboard a full entity from a JSON file (payload + mapping). The user uploads
// the file and picks its resource type; submitting opens a CREATE change request
// routed to that type's owner team for approval.
export function ImportEntity() {
  const { data: resources } = useQuery({ queryKey: ['resources'], queryFn: () => fetchResources() })
  const { data: available } = useQuery({ queryKey: ['available-types'], queryFn: fetchAvailableTypes })
  const types = Array.from(
    new Set([
      ...(available?.items ?? []).map((t) => t.name),
      ...(resources?.items ?? []).map((r) => r.type),
    ]),
  ).sort()

  const [type, setType] = useState('')
  const [entity, setEntity] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: ({ resourceType, payload }: { resourceType: string; payload: Record<string, unknown> }) =>
      submitRequest({ action: 'CREATE', resource_type: resourceType, resource_id: null, payload }),
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setEntity(JSON.parse(await file.text()))
      setError('')
    } catch {
      setEntity(null)
      setError('Invalid JSON file — could not parse.')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type) return setError('Choose a resource type.')
    if (!entity) return setError('Upload a valid JSON file first.')
    setError('')
    mutation.mutate({ resourceType: type, payload: entity })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import entity</h1>
        <p className="text-sm text-muted-foreground">
          Upload a full entity JSON (payload + mapping) and choose its type. This opens a create
          request routed to the owner team for approval.
        </p>
      </div>
      {mutation.isSuccess ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-5 text-sm text-success">
            Import request #{mutation.data.id} submitted for approval to {mutation.data.owner_team}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Resource type</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">Choose a type…</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Entity JSON file</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFile}
                  className="block w-full text-sm"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={mutation.isPending}>
                Import for approval
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {mutation.isError && <p className="text-sm text-destructive">Submit failed.</p>}
    </div>
  )
}
