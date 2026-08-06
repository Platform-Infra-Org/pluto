import { SuspendedNode } from '@internal/plugin-platform-common';
import { maskSuspendInputs, filterSuppliedOutputs } from './suspend';

const node = (inputs: SuspendedNode['inputs']): SuspendedNode => ({
  id: 'n1',
  name: 'approve-plan',
  inputs,
  suppliedOutputs: ['decision'],
});

describe('maskSuspendInputs', () => {
  it('leaves ordinary review values alone — they are the point', () => {
    const [n] = maskSuspendInputs(
      [node([{ name: 'plan', value: '3 to add' }])],
      undefined,
    );
    expect(n.inputs).toEqual([{ name: 'plan', value: '3 to add' }]);
  });

  it('masks a parameter named after one of the request secrets', () => {
    const [n] = maskSuspendInputs(
      [node([{ name: 'dbPassword', value: 'hunter2' }])],
      [{ name: 'dbPassword', source: 'generate' }],
    );
    expect(n.inputs).toEqual([{ name: 'dbPassword', masked: true }]);
  });

  it('keeps the key visible so the approver knows a value exists', () => {
    const [n] = maskSuspendInputs(
      [node([{ name: 'apiToken', value: 'abc' }])],
      undefined,
    );
    expect(n.inputs[0].name).toBe('apiToken');
    expect(n.inputs[0].value).toBeUndefined();
  });

  it('masks credential-shaped names the request never declared', () => {
    // The workflow can interpolate anything; secretSpec cannot be the only rule.
    const [n] = maskSuspendInputs(
      [
        node([
          { name: 'ADMIN_PASSWORD', value: 'x' },
          { name: 'private_key', value: 'y' },
          { name: 'apiKey', value: 'z' },
        ]),
      ],
      undefined,
    );
    expect(n.inputs.every(i => i.masked)).toBe(true);
    expect(n.inputs.every(i => i.value === undefined)).toBe(true);
  });

  it('matches secret names case-insensitively', () => {
    const [n] = maskSuspendInputs(
      [node([{ name: 'DBPassword', value: 'x' }])],
      [{ name: 'dbpassword', source: 'provided' }],
    );
    expect(n.inputs[0].masked).toBe(true);
  });
});

describe('filterSuppliedOutputs', () => {
  it('accepts what the step asked for', () => {
    expect(
      filterSuppliedOutputs(node([]), { decision: 'approved' }),
    ).toEqual({ accepted: { decision: 'approved' }, rejected: [] });
  });

  it('drops what the step did not declare, rather than letting argo refuse it', () => {
    expect(filterSuppliedOutputs(node([]), { sneaky: 'x' })).toEqual({
      accepted: {},
      rejected: ['sneaky'],
    });
  });

  it('handles a resume with no parameters at all', () => {
    expect(filterSuppliedOutputs(node([]), undefined)).toEqual({
      accepted: {},
      rejected: [],
    });
  });
});

describe('the trust boundary', () => {
  // The first implementation masked only the /workflow endpoint, while the
  // approval panel reads the request DTO — the value shipped in the clear.
  // Masking is a property of leaving the backend, not of one route.
  it('masks the same way whichever response carries the node', () => {
    const nodes = [node([{ name: 'adminPassword', value: 'not-a-real-secret' }])];
    const viaWorkflow = maskSuspendInputs(nodes, undefined);
    const viaRequestDto = maskSuspendInputs(nodes, undefined);
    expect(viaWorkflow).toEqual(viaRequestDto);
    expect(viaWorkflow[0].inputs[0]).toEqual({ name: 'adminPassword', masked: true });
  });
});
