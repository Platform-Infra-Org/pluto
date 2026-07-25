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

/**
 * Generate a Scaffolder Template (`template.yaml`) + an Argo WorkflowTemplate
 * from a service definition. Pure — no IO.
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

  // Every non-name field is threaded into the request params.
  const params: Record<string, string> = {};
  for (const f of fields) {
    if (f.name === 'name') continue;
    params[f.name] = `\${{ parameters.${f.name} }}`;
  }

  const template = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: def.name,
      title: def.title,
      tags: ['platform'],
    },
    spec: {
      owner: 'group:default/platform',
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

  const workflowTemplate = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'WorkflowTemplate',
    metadata: { name: def.name, namespace: 'argo' },
    spec: {
      entrypoint: 'create',
      arguments: { parameters: [{ name: 'request', value: '{}' }] },
      templates: [
        {
          name: 'create',
          inputs: { parameters: [{ name: 'request', value: '{}' }] },
          steps: [
            [
              {
                name: 'provision',
                template: 'provision',
                arguments: {
                  parameters: [
                    { name: 'request', value: '{{inputs.parameters.request}}' },
                  ],
                },
              },
            ],
          ],
        },
        {
          name: 'provision',
          inputs: { parameters: [{ name: 'request', value: '{}' }] },
          container: {
            image: 'alpine:3.20',
            command: ['sh', '-c'],
            args: [
              `echo "provisioning ${def.name}"\n` +
                'echo "request={{inputs.parameters.request}}"\n' +
                'sleep 4\n' +
                'echo done\n',
            ],
          },
        },
      ],
    },
  };

  return { templateYaml: stringify(template), workflowTemplate };
}
