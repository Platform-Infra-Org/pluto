// toBeDisabled/toHaveTextContent are jest-dom matchers; this plugin has no global setup.
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { DynamicSelectFieldComponent } from './DynamicSelectField';

const TREE = {
  coordinates: {
    prod: { core: { 'eu-west': { mgmt: ['dev'], paris: ['prod'] } } },
    // aurora branches at every level; borealis narrows to one option at each.
    // The pair is what lets the auto-select tests below prove both halves:
    // a single option is filled in, a real choice is left to the reader.
    aurora: { core: { 'eu-west': { mgmt: ['dev'] } }, edge: { 'ap-south': ['dev'] } },
    borealis: { lab: { cork: ['sandbox'] } },
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

  it('picks the only value a level offers, without asking', async () => {
    // borealis -> lab has exactly one region. Making someone open a dropdown to
    // confirm the only answer is friction, and in a cascade it compounds.
    const onChange = jest.fn();
    renderField({
      ...base,
      onChange,
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network'],
        },
      },
      formContext: { formData: { space: 'borealis', network: 'lab' } },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('cork'));
  });

  it('leaves a branching level alone', async () => {
    // Two options is a real choice and must stay the reader's.
    const onChange = jest.fn();
    renderField({
      ...base,
      onChange,
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space'],
        },
      },
      formContext: { formData: { space: 'aurora' } },
    });
    await screen.findByRole('option', { name: 'core' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never overrides a value the reader already chose', async () => {
    // Auto-select fires only into an empty field, so a deliberate pick stands
    // even where the level has since narrowed to one option.
    const onChange = jest.fn();
    renderField({
      ...base,
      onChange,
      formData: 'cork',
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network'],
        },
      },
      formContext: { formData: { space: 'borealis', network: 'lab' } },
    });
    await screen.findByRole('option', { name: 'cork' });
    expect(onChange).not.toHaveBeenCalled();
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
