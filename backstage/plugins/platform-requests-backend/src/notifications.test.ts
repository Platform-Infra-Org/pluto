import { createNotifier } from './notifications';

const logger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
} as any;

const DEFAULT_ADMINS = ['group:default/platform-admins'];

const request = (extra: Record<string, unknown> = {}) =>
  ({
    id: 1,
    kind: 'CREATE',
    resourceType: 'postgres',
    resourceName: 'db-a',
    requester: 'alice',
    ...extra,
  } as any);

const notifierWith = (adminGroups = DEFAULT_ADMINS, namespace?: string) => {
  const send = jest.fn().mockResolvedValue(undefined);
  return {
    send,
    notify: createNotifier({ send } as any, logger, adminGroups, namespace),
  };
};

/** The entityRefs of the single send() call, always as an array. */
const recipientsOf = (send: jest.Mock): string[] => {
  const ref = send.mock.calls[0][0].recipients.entityRef;
  return Array.isArray(ref) ? ref : [ref];
};

beforeEach(() => jest.clearAllMocks());

describe('approvalNeeded recipients', () => {
  it('notifies the default admin group when nothing is configured', async () => {
    const { send, notify } = notifierWith();
    await notify.approvalNeeded(request());
    expect(recipientsOf(send)).toEqual(['group:default/platform-admins']);
  });

  it('notifies the configured admin groups, not the old hardcoded literal', async () => {
    const { send, notify } = notifierWith([
      'group:default/sre',
      'group:default/leads',
    ]);
    await notify.approvalNeeded(request());
    expect(recipientsOf(send)).toEqual([
      'group:default/sre',
      'group:default/leads',
    ]);
    expect(recipientsOf(send)).not.toContain('group:default/platform-admins');
  });

  it('includes the owning team — the people the gate actually lets approve', async () => {
    const { send, notify } = notifierWith();
    await notify.approvalNeeded(
      request({ ownerGroup: 'group:default/team-a' }),
    );
    expect(recipientsOf(send)).toEqual([
      'group:default/platform-admins',
      'group:default/team-a',
    ]);
  });

  it('sends once to an owning team that is also an admin group', async () => {
    const { send, notify } = notifierWith(['group:default/team-a']);
    await notify.approvalNeeded(
      request({ ownerGroup: 'group:default/team-a' }),
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(recipientsOf(send)).toEqual(['group:default/team-a']);
  });

  it('falls back to admins only on an admin-only request', async () => {
    const { send, notify } = notifierWith();
    await notify.approvalNeeded(request({ ownerGroup: undefined }));
    expect(recipientsOf(send)).toEqual(['group:default/platform-admins']);
  });

  it('logs and does not throw when send rejects', async () => {
    const send = jest.fn().mockRejectedValue(new Error('notifications down'));
    const notify = createNotifier({ send } as any, logger, DEFAULT_ADMINS);
    await expect(notify.approvalNeeded(request())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('notify approvalNeeded failed for 1'),
    );
  });
});

describe('requester recipients honour the configured namespace', () => {
  it('uses the default namespace when none is given', async () => {
    const { send, notify } = notifierWith();
    await notify.finished(request(), true);
    expect(recipientsOf(send)).toEqual(['user:default/alice']);
  });

  it('uses a non-default namespace for decided and finished alike', async () => {
    const { send, notify } = notifierWith(DEFAULT_ADMINS, 'acme');
    await notify.decided(request({ state: 'REJECTED' }));
    expect(recipientsOf(send)).toEqual(['user:acme/alice']);

    send.mockClear();
    await notify.finished(request(), false);
    expect(recipientsOf(send)).toEqual(['user:acme/alice']);
  });

  it('says nothing while a request is still pending', async () => {
    const { send, notify } = notifierWith();
    await notify.decided(request({ state: 'PENDING_APPROVAL' }));
    expect(send).not.toHaveBeenCalled();
  });
});

describe('gateNeeded recipients', () => {
  const node = (name: string, approverGroup?: string) =>
    ({ id: name, name, approverGroup, inputs: [], suppliedOutputs: [] } as any);
  /** recipient -> title, one entry per send. */
  const sends = (send: jest.Mock) =>
    Object.fromEntries(
      send.mock.calls.map(([c]) => [c.recipients.entityRef, c.payload.title]),
    );

  it('tells each gate team only about its own step, and not the owner', async () => {
    const { send, notify } = notifierWith();
    await notify.gateNeeded(request({ ownerGroup: 'group:default/checkout' }), [
      node('approve-cost', 'group:default/payments'),
      node('approve-schema', ' group:default/search '),
    ]);
    expect(sends(send)).toEqual({
      'group:default/platform-admins':
        'Input needed: approve-cost, approve-schema on request #1',
      'group:default/payments': 'Input needed: approve-cost on request #1',
      'group:default/search': 'Input needed: approve-schema on request #1',
    });
  });

  it('sends an unannotated step to the owner and an empty one to admins only', async () => {
    const { send, notify } = notifierWith();
    await notify.gateNeeded(request({ ownerGroup: 'group:default/checkout' }), [
      node('review'),
      node('broken', '  '),
    ]);
    expect(sends(send)).toEqual({
      'group:default/platform-admins':
        'Input needed: review, broken on request #1',
      'group:default/checkout': 'Input needed: review on request #1',
    });
  });

  it('sends nothing when no gate is new', async () => {
    const { send, notify } = notifierWith();
    await notify.gateNeeded(request(), []);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps going when one send fails', async () => {
    const { send, notify } = notifierWith();
    send.mockRejectedValueOnce(new Error('down'));
    await notify.gateNeeded(request(), [node('a', 'group:default/payments')]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('notify gateNeeded failed for 1'),
    );
  });
});
