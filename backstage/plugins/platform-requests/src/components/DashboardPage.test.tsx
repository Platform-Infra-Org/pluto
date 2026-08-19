import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ConfigReader } from '@backstage/config';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/test-utils';
import { DashboardPage } from './DashboardPage';

function renderWith(config: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={[[configApiRef, new ConfigReader(config as never)]] as never}>
      <DashboardPage />
    </TestApiProvider>,
  );
}

describe('DashboardPage', () => {
  it('frames the configured dashboard', () => {
    const { container } = renderWith({
      platform: {
        grafana: {
          baseUrl: 'https://grafana.example.com',
          dashboard: { uid: 'abc123', slug: 'platform-overview' },
        },
      },
    });
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('explains rather than showing a blank body when unconfigured', () => {
    // The nav entry always exists, so the page has to say why it is empty
    // instead of rendering a title over nothing.
    renderWith({});
    expect(screen.queryByText(/no dashboard configured/i)).not.toBeNull();
  });
});
