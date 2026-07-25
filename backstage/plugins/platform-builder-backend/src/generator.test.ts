import { generateArtifacts, ServiceDefinitionInput } from './generator';

describe('generateArtifacts', () => {
  const def: ServiceDefinitionInput = {
    name: 'my-bucket',
    title: 'My Bucket',
    fields: [
      { name: 'region', title: 'Region', type: 'enum', enum: ['eu-west-1', 'us-east-1'], required: true },
      { name: 'size', title: 'Size', type: 'number' },
    ],
  };

  it('emits a Scaffolder template with params, submit step and output link', () => {
    const { templateYaml } = generateArtifacts(def);
    expect(templateYaml).toContain('name: my-bucket');
    expect(templateYaml).toContain('title: My Bucket');
    expect(templateYaml).toContain('platform:request:submit');
    expect(templateYaml).toContain('resourceType: my-bucket');
    // enum field mapped to string + enum
    expect(templateYaml).toContain('eu-west-1');
    // non-name fields threaded into params
    expect(templateYaml).toContain('${{ parameters.region }}');
    expect(templateYaml).toContain('/requests/${{ steps.submit.output.requestId }}');
  });

  it('adds an implicit required `name` field when missing', () => {
    const { templateYaml } = generateArtifacts(def);
    expect(templateYaml).toMatch(/name:\n\s+type: string\n\s+title: Name/);
    expect(templateYaml).toContain('resourceName: ${{ parameters.name }}');
    // name is not threaded into params
    expect(templateYaml).not.toContain('name: ${{ parameters.name }}');
  });

  it('does not duplicate an explicit `name` field', () => {
    const withName: ServiceDefinitionInput = {
      name: 'thing',
      title: 'Thing',
      fields: [{ name: 'name', type: 'string', required: true }],
    };
    const { templateYaml } = generateArtifacts(withName);
    // name is the only field: it maps to resourceName and nothing lands in params.
    expect(templateYaml.match(/\$\{\{ parameters\./g)?.length).toBe(1);
    expect(templateYaml).toContain('resourceName: ${{ parameters.name }}');
    expect(templateYaml).toContain('params: {}');
  });

  it('emits an Argo WorkflowTemplate named after the def with a provision container', () => {
    const { workflowTemplate } = generateArtifacts(def);
    expect(workflowTemplate).toMatchObject({
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'WorkflowTemplate',
      metadata: { name: 'my-bucket', namespace: 'argo' },
      spec: { entrypoint: 'create' },
    });
    const json = JSON.stringify(workflowTemplate);
    expect(json).toContain('alpine:3.20');
    expect(json).toContain('provisioning my-bucket');
  });
});
