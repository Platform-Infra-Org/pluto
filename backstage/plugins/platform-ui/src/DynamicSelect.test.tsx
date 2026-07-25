import { render, screen, waitFor } from '@testing-library/react';
import { DynamicSelect, toChoiceOptions } from './DynamicSelect';

describe('toChoiceOptions', () => {
  it('maps a JSON list to label == value', () => {
    expect(toChoiceOptions(['us-east-1', 'eu-west-1'])).toEqual([
      { label: 'us-east-1', value: 'us-east-1' },
      { label: 'eu-west-1', value: 'eu-west-1' },
    ]);
  });

  it('maps a JSON map to alias -> value', () => {
    expect(toChoiceOptions({ 'US East': 'us-east-1', 'EU West': 'eu-west-1' })).toEqual([
      { label: 'US East', value: 'us-east-1' },
      { label: 'EU West', value: 'eu-west-1' },
    ]);
  });

  it('returns [] for non-list/map input', () => {
    expect(toChoiceOptions(null)).toEqual([]);
    expect(toChoiceOptions(42)).toEqual([]);
    expect(toChoiceOptions('nope')).toEqual([]);
  });
});

function mockFetcher(responses: unknown[]) {
  let call = 0;
  return jest.fn(async () => {
    const body = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
    } as unknown as Response;
  });
}

describe('DynamicSelect', () => {
  it('renders options from a JSON list (fetched once)', async () => {
    const fetcher = mockFetcher([['us-east-1', 'eu-west-1']]);
    render(<DynamicSelect url="/api/regions" fetcher={fetcher} />);
    await screen.findByRole('option', { name: 'us-east-1' });
    await screen.findByRole('option', { name: 'eu-west-1' });
  });

  it('re-polls on the interval and updates options (map with aliases)', async () => {
    const fetcher = mockFetcher([
      ['us-east-1', 'eu-west-1'],
      { 'US East': 'us-east-1', 'EU West': 'eu-west-1', 'AP South': 'ap-south-1' },
    ]);

    render(<DynamicSelect url="/api/regions" intervalMs={300} fetcher={fetcher} />);

    // First load -> list (label == value).
    await screen.findByRole('option', { name: 'us-east-1' });
    // The interval triggers another fetch -> map response -> alias labels appear.
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2), {
      timeout: 3000,
    });
    await screen.findByRole('option', { name: 'AP South' });
  });

  it('surfaces an error when the API fails', async () => {
    const fetcher = jest.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    } as unknown as Response));

    render(<DynamicSelect url="/api/bad" fetcher={fetcher} />);
    await screen.findByText(/Could not load options/i);
  });
});
