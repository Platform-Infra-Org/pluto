import { Entity } from '@backstage/catalog-model';
import { Request } from '@internal/plugin-platform-common';
import {
  replayForRequest,
  replayTemplate,
  startOverData,
  startOverPath,
} from './RequestsPage';

const template = (name: string, resourceType: string, params: object): Entity => ({
  apiVersion: 'scaffolder.backstage.io/v1beta3',
  kind: 'Template',
  metadata: { name },
  spec: {
    steps: [
      {
        action: 'platform:request:submit',
        input: {
          resourceType,
          resourceName: '${{ parameters.metadata.name }}',
          params,
        },
      },
    ],
  },
});

const request = {
  id: 7,
  kind: 'CREATE',
  resourceType: 'vm',
  resourceName: 'web-01',
  params: { cpu: 4, network: 'prod' },
  state: 'SUCCEEDED',
  policy: { mode: 'SINGLE' },
  requester: 'casey',
  approvals: [],
  createdAt: '2026-10-13T08:00:00.000Z',
  updatedAt: '2026-10-13T08:05:00.000Z',
} as Request;

describe('Start Over', () => {
  it('reconstructs nested form values from the generic template mapping', () => {
    const replay = replayTemplate(
      template('provision-vm', 'vm', {
        cpu: '${{ parameters.compute.cpu }}',
        network: '${{ parameters.network }}',
      }),
    );

    expect(startOverData(request, replay)).toEqual({
      metadata: { name: 'web-01' },
      compute: { cpu: 4 },
      network: 'prod',
    });
    expect(startOverPath(replay!.path, startOverData(request, replay))).toContain(
      '/create/templates/default/provision-vm?formData=',
    );
  });

  it('selects the template whose mapped fields best match the request', () => {
    const partial = replayTemplate(
      template('small-vm', 'vm', { cpu: '${{ parameters.cpu }}' }),
    )!;
    const exact = replayTemplate(
      template('networked-vm', 'vm', {
        cpu: '${{ parameters.cpu }}',
        network: '${{ parameters.network }}',
      }),
    )!;

    expect(replayForRequest(request, [partial, exact])).toBe(exact);
  });
});
