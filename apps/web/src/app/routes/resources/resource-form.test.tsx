import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResourceForm } from './resource-form'

describe('ResourceForm', () => {
  it('renders nested objects, arrays and scalars', () => {
    render(
      <ResourceForm
        value={{
          name: 'orders-db',
          spec: { engine: 'postgres', version: 16 },
          regions: ['eu-west-1', 'us-east-1'],
        }}
      />,
    )
    // scalar row
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('orders-db')).toBeInTheDocument()
    // nested object subsection
    expect(screen.getByText('spec')).toBeInTheDocument()
    expect(screen.getByText('engine')).toBeInTheDocument()
    expect(screen.getByText('postgres')).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()
    // array items
    expect(screen.getByText('regions')).toBeInTheDocument()
    expect(screen.getByText('eu-west-1')).toBeInTheDocument()
    expect(screen.getByText('us-east-1')).toBeInTheDocument()
  })
})
