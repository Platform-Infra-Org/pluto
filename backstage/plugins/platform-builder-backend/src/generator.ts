import { stringify } from 'yaml';

export interface RequestField {
  name: string;
  title?: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  enum?: string[];
  required?: boolean;
}

export interface ServiceDefinitionInput {
  name: string;
  title: string;
  category?: string;
  /**
   * Owning team (the service owner) — a group entityRef or a bare group name
   * (normalized to `group:default/<name>`). Only this team, or an admin, can
   * approve requests for the generated type. Defaults to group:default/platform.
   */
  owner?: string;
  fields: RequestField[];
}

export interface GeneratedArtifacts {
  templateYaml: string;
  workflowTemplate: object;
}

/** JSON-schema prop for one field: enum→string+enum, else the JS primitive type. */
function fieldProperty(field: RequestField): Record<string, unknown> {
  const title = field.title ?? field.name;
  if (field.type === 'enum') {
    return { type: 'string', title, enum: field.enum ?? [] };
  }
  return { type: field.type, title };
}

/** Bare group name -> `group:default/<name>`; a full entityRef is left as-is. */
function normalizeOwner(owner?: string): string {
  const t = owner?.trim();
  if (!t) return 'group:default/platform';
  return t.includes(':') ? t : `group:default/${t}`;
}

/**
 * Generate a Scaffolder Template (`template.yaml`) + an Argo WorkflowTemplate
 * from a service definition, matching the platform's current conventions:
 * a `platform.io/resource-type` annotation, a team owner (= service owner),
 * and an explicit `argoSubmit` block whose runtime values use `<< token >>`
 * (resolved by the backend, distinct from Scaffolder's `${{ }}`). Pure — no IO.
 */
export function generateArtifacts(
  def: ServiceDefinitionInput,
): GeneratedArtifacts {
  // Ensure a `name` field (the resource instance name) always exists.
  const fields = def.fields.some(f => f.name === 'name')
    ? def.fields
    : [
        { name: 'name', title: 'Name', type: 'string', required: true } as const,
        ...def.fields,
      ];

  const properties: Record<string, unknown> = {};
  for (const f of fields) properties[f.name] = fieldProperty(f);

  const required = fields.filter(f => f.required).map(f => f.name);

  const dataFields = fields.filter(f => f.name !== 'name');

  // Form values -> request params (Scaffolder `${{ }}` templating).
  const params: Record<string, string> = {};
  for (const f of dataFields) params[f.name] = `\${{ parameters.${f.name} }}`;

  // Request params -> Argo submit parameters (backend `<< token >>` templating).
  const argoParameters: Record<string, string> = { name: '<< resourceName >>' };
  for (const f of dataFields) argoParameters[f.name] = `<< params.${f.name} >>`;
  argoParameters.request = '<< paramsJson >>';

  const owner = normalizeOwner(def.owner);

  const template = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: def.name,
      title: def.title,
      tags: ['platform', ...(def.category ? [def.category] : [])],
      annotations: {
        // Ties requests of this resourceType back to this template (and its
        // owner) for per-team approval.
        'platform.io/resource-type': def.name,
      },
    },
    spec: {
      // The template owner IS the service owner (per-team approval).
      owner,
      type: 'resource',
      parameters: [
        {
          title: def.title,
          required,
          properties,
        },
      ],
      steps: [
        {
          id: 'submit',
          name: 'Submit request',
          action: 'platform:request:submit',
          input: {
            resourceType: def.name,
            resourceName: '${{ parameters.name }}',
            kind: 'CREATE',
            params,
            argoSubmit: {
              namespace: 'argo',
              workflowTemplate: def.name,
              entrypoint: 'create',
              parameters: argoParameters,
              labels: {
                'platform.io/requested-by': '<< requester >>',
              },
            },
          },
        },
      ],
      output: {
        links: [
          {
            title: 'Open request',
            url: '/requests/${{ steps.submit.output.requestId }}',
          },
        ],
      },
    },
  };

  // WorkflowTemplate params mirror the argoSubmit parameters.
  const wfParamNames = ['name', ...dataFields.map(f => f.name), 'request'];
  const wfParams = wfParamNames.map(n => ({
    name: n,
    value: n === 'request' ? '{}' : '',
  }));
  const passThrough = wfParamNames.map(n => ({
    name: n,
    value: `{{inputs.parameters.${n}}}`,
  }));
  const echoes = [
    `echo "provisioning ${def.name} {{inputs.parameters.name}}"`,
    ...dataFields.map(f => `echo "${f.name}={{inputs.parameters.${f.name}}}"`),
    'echo "request={{inputs.parameters.request}}"',
    'sleep 4',
    'echo done',
  ].join('\n');

  const workflowTemplate = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'WorkflowTemplate',
    metadata: { name: def.name, namespace: 'argo' },
    spec: {
      entrypoint: 'create',
      arguments: { parameters: wfParams },
      templates: [
        {
          name: 'create',
          inputs: { parameters: wfParams },
          steps: [
            [
              {
                name: 'provision',
                template: 'provision',
                arguments: { parameters: passThrough },
              },
            ],
          ],
        },
        {
          name: 'provision',
          inputs: { parameters: wfParams },
          container: {
            image: 'alpine:3.20',
            command: ['sh', '-c'],
            args: [`${echoes}\n`],
          },
        },
      ],
    },
  };

  return { templateYaml: stringify(template), workflowTemplate };
}
