import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { DEFAULT_NAMESPACE } from '@internal/plugin-platform-common';

/**
 * The namespace this deployment's catalog entities live in.
 *
 * Config, not identity, so unlike `useIsAdmin` there is nothing async to wait
 * for — it returns a usable value on the first render and never `undefined`,
 * which is what lets callers build refs and hrefs inline instead of guarding.
 *
 * `platform.catalog.namespace` is declared `@visibility frontend`; without that
 * the key would be filtered out of the config the browser receives and this
 * would quietly return `default` while the backend used the configured value.
 */
export function useCatalogNamespace(): string {
  const config = useApi(configApiRef);
  return (
    config.getOptionalString('platform.catalog.namespace') ?? DEFAULT_NAMESPACE
  );
}
