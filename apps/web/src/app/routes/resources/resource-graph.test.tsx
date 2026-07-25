import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test-router'
import * as catalog from '@/lib/catalog'
import { ResourceGraph, layoutByDepth } from './resource-graph'

vi.mock('@/lib/catalog')

describe('layoutByDepth', () => {
  it('places the root at depth 0 and dependents at increasing depth', () => {
    const nodes = [
      { id: 1, name: 'A', type: 'db', id_value: 'A' },
      { id: 2, name: 'B', type: 'db', id_value: 'B' },
      { id: 3, name: 'C', type: 'db', id_value: 'C' },
    ]
    const edges = [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ]
    const depth = layoutByDepth(nodes, edges, 1)
    expect(depth.get(1)).toBe(0)
    expect(depth.get(2)).toBe(1)
    expect(depth.get(3)).toBe(2)
  })
})

describe('ResourceGraph', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a note when the resource has no dependencies', async () => {
    vi.mocked(catalog.fetchResourceGraph).mockResolvedValue({
      nodes: [{ id: 1, name: 'A', type: 'db', id_value: 'A' }],
      edges: [],
    })
    renderWithRouter(<ResourceGraph id={1} />, ['/resources/$resourceId'])
    expect(await screen.findByText(/no dependencies/i)).toBeInTheDocument()
  })

  it('fetches the graph for the given resource id', async () => {
    vi.mocked(catalog.fetchResourceGraph).mockResolvedValue({ nodes: [], edges: [] })
    renderWithRouter(<ResourceGraph id={7} />, ['/resources/$resourceId'])
    await waitFor(() => expect(catalog.fetchResourceGraph).toHaveBeenCalledWith(7))
  })
})
