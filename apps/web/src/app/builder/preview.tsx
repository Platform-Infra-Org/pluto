import { useState } from 'react'
import { SchemaForm, type Widget } from '@/app/forms/SchemaForm'
import { buildSchema, buildUiSchema, type BuilderField } from './schema'

// Live preview — renders the builder's fields with the EXACT renderer requesters
// use (SchemaForm), so "what the owner builds" == "what the requester sees".
// Server-backed widgets are shown as their real controls; option data is served
// by the BFF at request time (a static placeholder in the builder preview).
const previewWidgets: Record<string, Widget> = {
  upload: ({ name }) => <input aria-label={name} type="file" disabled className="block" />,
  groups: ({ name }) => (
    <select aria-label={name} disabled className="border rounded px-2 py-1 w-full">
      <option>groups served by the BFF</option>
    </select>
  ),
  options: ({ name }) => (
    <select aria-label={name} disabled className="border rounded px-2 py-1 w-full">
      <option>options synced by the BFF</option>
    </select>
  ),
}

export function Preview({ fields }: { fields: BuilderField[] }) {
  const [value, setValue] = useState<Record<string, unknown>>({})
  return (
    <div className="border rounded p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-500 mb-3">Live preview</h3>
      <SchemaForm
        schema={buildSchema(fields)}
        uiSchema={buildUiSchema(fields)}
        value={value}
        onChange={setValue}
        widgets={previewWidgets}
      />
    </div>
  )
}
