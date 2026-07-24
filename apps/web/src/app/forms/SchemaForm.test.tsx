import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SchemaForm, type JsonSchema } from './SchemaForm'

const schema: JsonSchema = {
  properties: {
    engine: { type: 'string', title: 'Engine' },
    size: { type: 'number' },
    tier: { type: 'string', enum: ['bronze', 'silver', 'gold'] },
  },
  required: ['engine'],
}

describe('SchemaForm', () => {
  it('renders a field per property, marks required, and renders enums as a select', () => {
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
    expect(screen.getByLabelText('engine')).toBeInTheDocument()
    expect(screen.getByLabelText('size')).toHaveAttribute('type', 'number')
    // enum -> <select> with one <option> per choice
    const select = screen.getByLabelText('tier') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'gold' })).toBeInTheDocument()
    // required marker
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('coerces number inputs and emits the updated value via onChange', () => {
    const onChange = vi.fn()
    render(<SchemaForm schema={schema} value={{}} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('size'), { target: { value: '8' } })
    expect(onChange).toHaveBeenCalledWith({ size: 8 })
  })

  it('shows validation errors passed in by the parent', () => {
    render(
      <SchemaForm
        schema={schema}
        value={{}}
        onChange={() => {}}
        errors={{ engine: 'engine is required' }}
      />,
    )
    expect(screen.getByText('engine is required')).toBeInTheDocument()
  })
})
