import { SuspendedNode, SuppliedOutput } from '@internal/plugin-platform-common';
import { filterSuppliedOutputs } from './suspend';

const node = (suppliedOutputs: SuppliedOutput[]): SuspendedNode => ({
  id: 'n1',
  name: 'approve-plan',
  inputs: [],
  suppliedOutputs,
});

const required = (name: string): SuppliedOutput => ({ name, required: true });
const choice = (name: string, values: string[]): SuppliedOutput => ({
  name,
  enum: values,
  required: true,
});
const optional = (name: string, dflt: string): SuppliedOutput => ({
  name,
  default: dflt,
  required: false,
});

describe('filterSuppliedOutputs', () => {
  it('accepts an answer the step asked for', () => {
    expect(
      filterSuppliedOutputs(node([required('decision')]), {
        decision: 'approved',
      }),
    ).toEqual({ accepted: { decision: 'approved' }, rejected: [], missing: [], invalid: [] });
  });

  it('drops a parameter the step never declared', () => {
    // Argo would refuse it; dropping it here keeps the failure legible.
    expect(filterSuppliedOutputs(node([]), { sneaky: 'x' })).toEqual({
      accepted: {},
      rejected: ['sneaky'],
      missing: [],
      invalid: [],
    });
  });

  it('reports a required answer that was not given', () => {
    expect(filterSuppliedOutputs(node([required('decision')]), {})).toEqual({
      accepted: {},
      rejected: [],
      missing: ['decision'],
      invalid: [],
    });
  });

  it('treats a blank string as no answer at all', () => {
    // An empty text field is someone not answering, not answering "".
    expect(
      filterSuppliedOutputs(node([required('decision')]), { decision: '' }),
    ).toEqual({ accepted: {}, rejected: [], missing: ['decision'], invalid: [] });
  });

  it('fills in the step declared default when a field is left blank', () => {
    expect(
      filterSuppliedOutputs(node([optional('ticket', 'none')]), { ticket: '' }),
    ).toEqual({ accepted: { ticket: 'none' }, rejected: [], missing: [], invalid: [] });
  });

  it('lets an answer beat the default', () => {
    expect(
      filterSuppliedOutputs(node([optional('ticket', 'none')]), {
        ticket: 'OPS-12',
      }),
    ).toEqual({ accepted: { ticket: 'OPS-12' }, rejected: [], missing: [], invalid: [] });
  });

  it('never calls an output with a default missing', () => {
    // A default is the workflow author saying "resume without this if you like".
    expect(filterSuppliedOutputs(node([optional('ticket', 'none')]), {})).toEqual(
      { accepted: { ticket: 'none' }, rejected: [], missing: [], invalid: [] },
    );
  });

  it('handles a step that asks nothing', () => {
    expect(filterSuppliedOutputs(node([]), undefined)).toEqual({
      accepted: {},
      rejected: [],
      missing: [],
      invalid: [],
    });
  });

  it('collects every missing answer, not just the first', () => {
    expect(
      filterSuppliedOutputs(node([required('a'), required('b')]), {}).missing,
    ).toEqual(['a', 'b']);
  });

  it('accepts a value the enum lists', () => {
    expect(
      filterSuppliedOutputs(node([choice('decision', ['approve', 'reject'])]), {
        decision: 'approve',
      }).accepted,
    ).toEqual({ decision: 'approve' });
  });

  it('refuses a value outside the enum, and says what is allowed', () => {
    // The form only offers the listed values, but a form is a convenience and
    // not a boundary — the API is the boundary.
    const r = filterSuppliedOutputs(
      node([choice('decision', ['approve', 'reject'])]),
      { decision: 'maybe' },
    );
    expect(r.invalid).toEqual([
      { name: 'decision', allowed: ['approve', 'reject'] },
    ]);
    expect(r.accepted).toEqual({});
  });

  it('does not also call an enum violation "missing"', () => {
    // Answering with a forbidden value and leaving the field blank are
    // different mistakes; reporting both tells someone they failed to fill in
    // the field they just filled in.
    const r = filterSuppliedOutputs(node([choice('decision', ['approve'])]), {
      decision: 'nope',
    });
    expect(r.invalid).toHaveLength(1);
    expect(r.missing).toEqual([]);
  });
});
