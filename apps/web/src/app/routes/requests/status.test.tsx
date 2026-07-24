import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as requests from '@/lib/requests'
import { WorkflowStatusView } from './status'

vi.mock('@/lib/requests')

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <WorkflowStatusView id={1} />
    </QueryClientProvider>,
  )
}

const FAILED: requests.RequestStatus = {
  phase: 'Failed',
  nodes: [
    { id: 'a', name: 'wf', display_name: 'deploy', type: 'DAG', phase: 'Failed', message: '', children: ['b'], failed: false },
    { id: 'b', name: 'wf.deploy-db', display_name: 'deploy-db', type: 'Pod', phase: 'Failed', message: 'could not connect to database', children: [], failed: true },
  ],
  failed_step: { node: 'deploy-db', message: 'could not connect to database', phase: 'Failed' },
}

describe('WorkflowStatusView', () => {
  it('renders the node tree and highlights the failed step with its message', async () => {
    vi.mocked(requests.fetchRequestStatus).mockResolvedValue(FAILED)
    renderView()

    // Every step listed.
    expect(await screen.findByText('deploy-db')).toBeInTheDocument()
    expect(screen.getByText('deploy')).toBeInTheDocument()

    // The failed step is flagged (role=alert) and shows its message.
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('deploy-db')
    expect(alert).toHaveTextContent('could not connect to database')
  })

  it('shows the overall phase for a running workflow', async () => {
    vi.mocked(requests.fetchRequestStatus).mockResolvedValue({
      phase: 'Running',
      nodes: [{ id: 'a', name: 'wf', display_name: 'build', type: 'Pod', phase: 'Running', message: '', children: [], failed: false }],
      failed_step: null,
    })
    renderView()

    expect(await screen.findByText('build')).toBeInTheDocument()
    expect(screen.getByText('Workflow phase:')).toBeInTheDocument()
    expect(screen.getAllByText(/Running/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
