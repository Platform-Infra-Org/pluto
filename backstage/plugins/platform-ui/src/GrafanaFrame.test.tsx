// toHaveAttribute is a jest-dom matcher; this plugin has no global setup
// registering it (unlike plugin-platform-requests), so it's imported per-file,
// matching this repo's existing convention (see SuspendPanel.test.tsx).
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GrafanaFrame } from './GrafanaFrame';

describe('GrafanaFrame', () => {
  it('renders nothing without a target', () => {
    // An unconfigured deployment degrades to absent, not to an empty box the
    // user cannot explain.
    const { container } = render(<GrafanaFrame title="Platform dashboard" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('frames the target src', () => {
    const { container } = render(
      <GrafanaFrame
        title="Platform dashboard"
        target={{
          baseUrl: 'https://grafana.example.com',
          src: 'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
        }}
      />,
    );
    const frame = container.querySelector('iframe');
    expect(frame!.getAttribute('src')).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
    );
    expect(frame!.getAttribute('title')).toBe('Platform dashboard');
    // Grafana does not run sandboxed; the protection is the origin check plus
    // a frame-src naming exactly one host.
    expect(frame!.getAttribute('sandbox')).toBeNull();
    expect(frame!.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('honours the height', () => {
    const { container } = render(
      <GrafanaFrame
        title="x"
        height={800}
        target={{ baseUrl: 'https://grafana.example.com', src: 'https://grafana.example.com/d/a/b' }}
      />,
    );
    expect(container.querySelector('iframe')!.getAttribute('height')).toBe('800');
  });

  it('offers a way out when the target was rejected', () => {
    // Configured-but-wrong is an operator error and must not look identical to
    // not-configured.
    const { container } = render(
      <GrafanaFrame title="x" target={{ baseUrl: 'https://grafana.example.com' }} />,
    );
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /open grafana/i })).toHaveAttribute(
      'href',
      'https://grafana.example.com',
    );
  });
});
