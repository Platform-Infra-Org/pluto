// toBeDisabled/toHaveTextContent are jest-dom matchers; this plugin has no global setup.
import '@testing-library/jest-dom';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { DynamicSelectFieldComponent } from './DynamicSelectField';
import { resetTreeStore } from './treeStore';

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

  it('reads the ancestors from registry.formContext when that is the only copy', async () => {
    // RJSF v5's canonical location. FieldProps.formContext is optional and is
    // undefined under Backstage's Stepper, so a field that reads only the
    // top-level prop sees no ancestors at all and blocks every level below it.
    renderField({
      ...base,
      formContext: undefined,
      registry: { formContext: { formData: { space: 'prod', network: 'core' } } },
      uiSchema: {
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          dependsOn: ['space', 'network'],
        },
      },
    });
    await screen.findByRole('option', { name: 'eu-west' });
  });

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

// The tests above hand each field a static formContext, which cannot show what
// a cascade does once the fields are wired to one form and feeding each other.
// These two mount the whole chain through a real RJSF form, wired the way the
// scaffolder Stepper wires it (formContext.formData = the whole form).
describe('the whole cascade, through a real form', () => {
  // One child at every level until the third: the shape that makes auto-select
  // fill in space and network before the reader is asked anything.
  const CHAIN = {
    coordinates: {
      operational: {
        'eu-west': {
          paris: { island: ['dev', 'prp', 'prd'] },
          'eu-east': { island: ['dev', 'opr'] },
        },
      },
    },
  };

  const LEVELS: Array<[string, string[]]> = [
    ['space', []],
    ['network', ['space']],
    ['region', ['space', 'network']],
    ['island', ['space', 'network', 'region']],
    ['environment', ['space', 'network', 'region', 'island']],
  ];

  const levelsSchema = {
    type: 'object' as const,
    properties: Object.fromEntries(
      LEVELS.map(([n]) => [n, { type: 'string' as const, title: n }]),
    ),
  };

  const levelsUiSchema = Object.fromEntries(
    LEVELS.map(([n, dependsOn]) => [
      n,
      {
        'ui:field': 'DynamicSelect',
        'ui:options': {
          proxyPath: '/infra/coordinate-tree',
          treePath: 'coordinates',
          ...(dependsOn.length ? { dependsOn } : {}),
        },
      },
    ]),
  );

  function renderForm(schemaIn: object, uiSchemaIn: object) {
    function Harness() {
      const [formData, setFormData] = useState<Record<string, unknown>>({});
      return (
        <Form
          validator={validator}
          schema={schemaIn as never}
          uiSchema={uiSchemaIn}
          formData={formData}
          formContext={{ formData }}
          fields={{ DynamicSelect: DynamicSelectFieldComponent } as never}
          onChange={e => setFormData(current => ({ ...current, ...e.formData }))}
        />
      );
    }
    return render(
      <TestApiProvider apis={apis(CHAIN) as never}>
        <Harness />
      </TestApiProvider>,
    );
  }

  async function expectCascaded() {
    const boxes = await screen.findAllByRole('combobox');
    await waitFor(() => expect(boxes[0]).toHaveValue('operational'));
    await waitFor(() => expect(boxes[1]).toHaveValue('eu-west'));
    // The first level that genuinely branches is where the reader takes over.
    await waitFor(() => expect(boxes[2]).not.toBeDisabled());
    expect(
      Array.from(boxes[2].querySelectorAll('option')).map(o => o.textContent),
    ).toEqual(expect.arrayContaining(['paris', 'eu-east']));
  }

  beforeEach(() => resetTreeStore());

  it('auto-fills every single-child level down to the first real choice', async () => {
    renderForm(levelsSchema, levelsUiSchema);
    await expectCascaded();
  });

  it('does the same when the levels are grouped under an object property', async () => {
    // `dependsOn: [space]` names a sibling, and under a group the siblings live
    // at metadata.space, not at the form root. Resolving against the root found
    // nothing, so every level below the first sat disabled on "Pick space
    // first" while the first, having no ancestors, filled itself in.
    renderForm(
      { type: 'object', properties: { metadata: levelsSchema } },
      { metadata: levelsUiSchema },
    );
    await expectCascaded();
  });
});
