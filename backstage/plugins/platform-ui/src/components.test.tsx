import { render } from '@testing-library/react';
import { ApiProvider } from '@backstage/core-app-api';
import { TestApiRegistry } from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { ConfigReader } from '@backstage/config';
import { PlatformMark } from './components';

const renderMark = (config: object) =>
  render(
    <ApiProvider
      apis={TestApiRegistry.from([configApiRef, new ConfigReader(config)])}
    >
      <PlatformMark />
    </ApiProvider>,
  );

describe('PlatformMark', () => {
  it('draws the built-in glyph when no mark is configured', () => {
    const { container } = renderMark({});
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // currentColor is what lets the color picker tint the glyph.
    expect(svg!.getAttribute('fill')).toBe('currentColor');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the configured mark as a decorative image', () => {
    const { container } = renderMark({
      app: { branding: { mark: '/branding/mark.svg' } },
    });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/branding/mark.svg');
    // Decorative: the surrounding link/heading already names the product, so it
    // must not announce itself a second time.
    expect(img!.getAttribute('aria-hidden')).toBe('true');
    expect(img!.getAttribute('alt')).toBe('');
    expect(container.querySelector('svg')).toBeNull();
  });
});
