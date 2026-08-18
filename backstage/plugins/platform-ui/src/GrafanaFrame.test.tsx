// toHaveAttribute is a jest-dom matcher; this plugin has no global setup
// registering it (unlike plugin-platform-requests), so it's imported per-file,
// matching this repo's existing convention (see SuspendPanel.test.tsx).
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ConfigReader } from '@backstage/config';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/test-utils';
import { GrafanaFrame } from './GrafanaFrame';

function renderWith(config: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={[[configApiRef, new ConfigReader(config as any)]] as never}>
      <GrafanaFrame title="Platform dashboard" />
    </TestApiProvider>,
  );
}

const GOOD = {
  platform: {
    grafana: {
      baseUrl: 'https://grafana.example.com',
      dashboard: { uid: 'abc123', slug: 'platform-overview' },
      kiosk: true,
    },
  },
};

describe('GrafanaFrame', () => {
  it('frames the configured dashboard', () => {
    const { container } = renderWith(GOOD);
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute('src')).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
    );
    // Grafana does not run sandboxed; the protection is the origin check plus
    // a frame-src naming exactly one host.
    expect(frame!.getAttribute('sandbox')).toBeNull();
    expect(frame!.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('renders nothing when grafana is not configured', () => {
    // An unconfigured deployment degrades to absent, not to an empty box the
    // user cannot explain.
    const { container } = renderWith({});
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('refuses to frame a host outside the configured origin', () => {
    const { container } = renderWith({
      platform: {
        grafana: {
          baseUrl: 'https://grafana.example.com',
          // A dashboard reference could one day come from an annotation, which
          // is user-writable. If the built URL leaves the configured origin,
          // the frame must not render.
          dashboard: { uid: '../../..//evil.example.com/x', slug: 'y' },
        },
      },
    });
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /open grafana/i })).toHaveAttribute(
      'href',
      'https://grafana.example.com',
    );
  });
});
