import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Preview } from './preview'
import type { BuilderField } from './schema'

// The preview renders through the SAME SchemaForm requesters use, so the fields
// the owner builds appear exactly as a requester would see them.
describe('Preview', () => {
  it('renders base fields and server-backed widgets from the builder fields', () => {
    const fields: BuilderField[] = [
      { key: 'engine', label: 'Engine', type: 'string', required: true },
      { key: 'tier', type: 'enum', enumValues: ['bronze', 'gold'] },
      { key: 'members', type: 'groups' },
    ]
    render(<Preview fields={fields} />)
    // base string field present, labelled by key
    expect(screen.getByLabelText('engine')).toBeInTheDocument()
    // enum -> select with the choices
    expect(screen.getByRole('option', { name: 'gold' })).toBeInTheDocument()
    // server-backed groups widget rendered (BFF-served control)
    expect(screen.getByLabelText('members')).toBeInTheDocument()
    // required marker shows
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
