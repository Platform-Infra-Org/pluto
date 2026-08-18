// toBeDisabled/toHaveTextContent are jest-dom matchers; this plugin has no global setup.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { DynamicSelectFieldComponent } from './DynamicSelectField';

const TREE = {
  coordinates: {
    prod: { core: { 'eu-west': { mgmt: ['dev'], paris: ['prod'] } } },
  },
};

function apis(body: unknown = TREE) {
  return [
    [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/proxy' }],
    [
      fetchApiRef,
      {
        fetch: async () =>
          ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as Response,
      },
    ],
  ] as const;
}

function renderField(props: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={apis() as never}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DynamicSelectFieldComponent {...(props as any)} />
    </TestApiProvider>,
  );
}

describe('DynamicSelectFieldComponent', () => {
  const base = {
    onChange: jest.fn(),
    schema: { title: 'Island' },
    formData: '',
  };

  it('offers the children of the chosen ancestors', async () => {
    renderField({
      ...base,
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network', 'region'],
        },
      },
      formContext: { formData: { space: 'prod', network: 'core', region: 'eu-west' } },
    });
    await screen.findByRole('option', { name: 'mgmt' });
    await screen.findByRole('option', { name: 'paris' });
  });

  it('is disabled and says so while an ancestor is unset', async () => {
    renderField({
      ...base,
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network'],
        },
      },
      formContext: { formData: { space: 'prod' } },
    });
    const select = await screen.findByRole('combobox');
    expect(select).toBeDisabled();
    expect(select).toHaveTextContent(/Pick network first/i);
  });

  it('drops a selection the new branch does not contain', async () => {
    const onChange = jest.fn();
    renderField({
      ...base,
      onChange,
      formData: 'paris',
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network', 'region'],
        },
      },
      // A region whose islands do not include 'paris'.
      formContext: { formData: { space: 'prod', network: 'core', region: 'nowhere' } },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
  });

  it('shares one fetch across sibling fields asking the same proxyPath', async () => {
    const fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => TREE,
    } as Response));
    const uiSchema = {
      'ui:options': {
        // A path distinct from the other tests' in this file: the tree cache
        // is keyed by URL and shared module-wide, so reusing '/infra/coordinate-tree'
        // here would hit a cache entry warmed by an earlier test instead of
        // proving these two sibling fields share one fetch.
        proxyPath: '/infra/coordinate-tree-shared',
        treePath: 'coordinates',
        dependsOn: ['space', 'network'],
      },
    };
    const formContext = { formData: { space: 'prod', network: 'core' } };
    render(
      <TestApiProvider
        apis={
          [
            [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/proxy' }],
            [fetchApiRef, { fetch }],
          ] as never
        }
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <DynamicSelectFieldComponent {...({ ...base, uiSchema, formContext } as any)} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <DynamicSelectFieldComponent {...({ ...base, uiSchema, formContext } as any)} />
      </TestApiProvider>,
    );
    await screen.findAllByRole('option', { name: 'eu-west' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
