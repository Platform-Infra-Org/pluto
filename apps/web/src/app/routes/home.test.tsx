import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from './home'

describe('HomePage', () => {
  it('renders the Platform heading', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Platform' })).toBeInTheDocument()
  })
})
