import { useState } from 'react'
import { SchemaForm, type Widget } from '@/app/forms/SchemaForm'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { buildSchema, buildUiSchema, type BuilderField } from './schema'

// Live preview — renders the builder's fields with the EXACT renderer requesters
// use (SchemaForm), so "what the owner builds" == "what the requester sees".
// Server-backed widgets are shown as their real controls; option data is served
// by the BFF at request time (a static placeholder in the builder preview).
const disabledSelect =
  'mt-1 block h-9 w-full rounded-md border border-input bg-muted px-2 text-sm text-muted-foreground'

const previewWidgets: Record<string, Widget> = {
  upload: ({ name }) => <input aria-label={name} type="file" disabled className="mt-1 block text-sm" />,
  groups: ({ name }) => (
    <select aria-label={name} disabled className={disabledSelect}>
      <option>groups served by the BFF</option>
    </select>
  ),
  options: ({ name }) => (
    <select aria-label={name} disabled className={disabledSelect}>
      <option>options synced by the BFF</option>
    </select>
  ),
}

export function Preview({ fields }: { fields: BuilderField[] }) {
  const [value, setValue] = useState<Record<string, unknown>>({})
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SchemaForm
          schema={buildSchema(fields)}
          uiSchema={buildUiSchema(fields)}
          value={value}
          onChange={setValue}
          widgets={previewWidgets}
        />
      </CardContent>
    </Card>
  )
}
