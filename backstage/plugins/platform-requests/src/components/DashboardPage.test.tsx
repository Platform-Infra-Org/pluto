import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfigReader } from '@backstage/config';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/test-utils';
import { DashboardPage } from './DashboardPage';

function renderWith(config: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={[[configApiRef, new ConfigReader(config as never)]] as never}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </TestApiProvider>,
  );
}

const CONFIGURED = {
  platform: {
    grafana: {
      baseUrl: 'https://grafana.example.com',
      dashboard: { uid: 'abc123', slug: 'platform-overview' },
    },
  },
};

describe('DashboardPage', () => {
  it('frames the configured dashboard', () => {
    const { container } = renderWith(CONFIGURED);
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('sends you home when unconfigured', () => {
    // The nav entry is gone in this case (navVisibility), so this only covers
    // a typed or bookmarked URL. A blank page under a title is worse than
    // landing somewhere real.
    renderWith({});
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText(/platform metrics/i)).toBeNull();
  });

  it('sends you home when the key exists but says nothing', () => {
    renderWith({ platform: { grafana: {} } });
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
