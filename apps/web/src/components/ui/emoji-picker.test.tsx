import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmojiPicker } from './emoji-picker'

describe('EmojiPicker', () => {
  it('opens, filters by search, and selects an emoji', () => {
    const onChange = vi.fn()
    render(<EmojiPicker value="" onChange={onChange} />)
    // Trigger shows the default placeholder emoji.
    const trigger = screen.getByRole('button', { name: 'icon' })
    expect(trigger).toHaveTextContent('📦')
    fireEvent.click(trigger)
    // Search narrows the grid.
    fireEvent.change(screen.getByLabelText('search icons'), { target: { value: 'lock' } })
    const lock = screen.getByRole('menuitemradio', { name: 'lock' })
    fireEvent.click(lock)
    expect(onChange).toHaveBeenCalledWith('🔒')
    // Popover closes after choosing.
    expect(screen.queryByLabelText('search icons')).not.toBeInTheDocument()
  })

  it('renders the current value on the trigger', () => {
    render(<EmojiPicker value="🚀" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'icon' })).toHaveTextContent('🚀')
  })
})
