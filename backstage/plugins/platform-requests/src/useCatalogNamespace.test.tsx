import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider, mockApis } from '@backstage/test-utils';
import { useCatalogNamespace } from './useCatalogNamespace';

const withConfig = (data: object) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestApiProvider apis={[[configApiRef, mockApis.config({ data })]]}>
      {children}
    </TestApiProvider>
  );
  return renderHook(() => useCatalogNamespace(), { wrapper }).result.current;
};

describe('useCatalogNamespace', () => {
  it('returns the configured namespace', () => {
    expect(withConfig({ platform: { catalog: { namespace: 'platform' } } })).toBe(
      'platform',
    );
  });

  it('falls back to the default when the key is unset', () => {
    expect(withConfig({})).toBe('default');
  });
});
