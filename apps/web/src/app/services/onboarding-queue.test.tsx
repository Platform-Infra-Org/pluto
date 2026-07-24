import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as services from '@/lib/services'

vi.mock('@/lib/services')

import { OnboardingQueue } from './onboarding-queue'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <OnboardingQueue />
    </QueryClientProvider>,
  )
}

const ITEM = {
  request_id: 7,
  requester: 'owner1',
  state: 'PENDING_APPROVAL',
  definition: {
    id: 3,
    name: 'app-database',
    category: 'data',
    owner_team: 'payments',
    form_schema: { type: 'object', properties: {} },
    ui_schema: {},
    workflow_binding: {},
    approval_policy: { mode: 'SINGLE' },
    git_path: 'resources/app-database/',
    status: 'PENDING_ONBOARDING' as const,
    version: 2,
    generated: {
      build_json_j2: '{ "payload": {{ request.name }} }',
      workflow_template_yaml: 'kind: WorkflowTemplate\nmetadata:\n  name: app-database',
    },
  },
}

beforeEach(() => {
  vi.mocked(services.fetchOnboardingQueue).mockResolvedValue({ items: [ITEM] })
  vi.mocked(services.approveOnboarding).mockResolvedValue({ state: 'APPROVED', definition_status: 'ACTIVE' })
})

describe('OnboardingQueue generated review + print-for-git', () => {
  it('renders the generated WorkflowTemplate + build-json.j2 for admin review', async () => {
    renderPage()
    expect(await screen.findByText(/kind: WorkflowTemplate/)).toBeInTheDocument()
    expect(screen.getByText(/"payload"/)).toBeInTheDocument()
  })

  it('offers the generated templates as copy + download (print for Git)', async () => {
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    renderPage()
    await screen.findByText(/kind: WorkflowTemplate/)

    // Downloadable: an anchor with a download attribute for the WorkflowTemplate.
    const dl = screen.getByRole('link', { name: /download workflowtemplate/i })
    expect(dl).toHaveAttribute('download', expect.stringMatching(/app-database.*\.ya?ml/i))

    // Copyable.
    fireEvent.click(screen.getByRole('button', { name: /copy workflowtemplate/i }))
    expect(writeText).toHaveBeenCalledWith(ITEM.definition.generated.workflow_template_yaml)
  })

  it('approves via the admin endpoint', async () => {
    renderPage()
    await screen.findByText(/kind: WorkflowTemplate/)
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }))
    await waitFor(() => expect(services.approveOnboarding).toHaveBeenCalledWith(7, ''))
  })
})
