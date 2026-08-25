import {
  AuthorizeResult,
  createPermission,
} from '@backstage/plugin-permission-common';
import { createConditionAuthorizer } from '@backstage/plugin-permission-node';
import { permissionRules } from '@backstage/plugin-catalog-backend/alpha';
import { PLATFORM_PERMISSIONS } from '@internal/plugin-platform-common';
import { PlatformPermissionPolicy } from './module';

// Reconstructed rather than imported from @backstage/plugin-catalog-common:
// this module isn't authorised to depend on that package, and this is the
// exact shape (name/attributes/resourceType) the real singleton has.
const catalogEntityReadPermission = createPermission({
  name: 'catalog.entity.read',
  attributes: { action: 'read' },
  resourceType: 'catalog-entity',
});

function userWith(refs: string[]) {
  return {
    info: { userEntityRef: 'user:default/x', ownershipEntityRefs: refs },
  } as any;
}

const query = (name: string) => ({ permission: { name } }) as any;

type StubTemplate = {
  metadata: { name: string; annotations: Record<string, string> };
  spec: { owner: string };
};

function tpl(resourceType: string, owner: string): StubTemplate {
  return {
    metadata: {
      name: resourceType,
      annotations: { 'platform.io/resource-type': resourceType },
    },
    spec: { owner },
  };
}

const noopLogger = { warn: () => {} } as any;

// The real catalog rules, applied to a real entity: the only way to tell
// "visible" from "shaped like it might be visible". Structural assertions on
// the criteria tree are what let the Template regression ship.
const isVisible = createConditionAuthorizer(
  Object.values(permissionRules) as any,
);

const entity = (
  kind: string,
  opts: { resourceType?: string; ownedBy?: string } = {},
) =>
  ({
    apiVersion: 'x/v1',
    kind,
    metadata: {
      name: 'thing',
      ...(opts.resourceType
        ? { annotations: { 'platform.io/resource-type': opts.resourceType } }
        : {}),
    },
    ...(opts.ownedBy
      ? { relations: [{ type: 'ownedBy', targetRef: opts.ownedBy }] }
      : {}),
  }) as any;

function makePolicy(opts: { templates?: StubTemplate[] } = {}) {
  const catalog = {
    getEntities: async () => ({ items: opts.templates ?? [] }),
  } as any;
  const auth = { getOwnServiceCredentials: async () => ({}) } as any;
  return new PlatformPermissionPolicy(
    ['group:default/platform-admins'],
    ['group:default/platform-auditors'],
    catalog,
    auth,
    noopLogger,
  );
}

const policy = new PlatformPermissionPolicy(
  ['group:default/platform-admins'],
  ['group:default/platform-auditors'],
  { getEntities: async () => ({ items: [] }) } as any,
  { getOwnServiceCredentials: async () => ({}) } as any,
  noopLogger,
);

describe('PlatformPermissionPolicy', () => {
  it('allows approve/create for anyone except a pure auditor', async () => {
    const admin = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/platform-admins']),
    );
    const owner = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/owners-payments']),
    );
    const auditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/platform-auditors']),
    );
    expect(admin.result).toBe(AuthorizeResult.ALLOW);
    expect(owner.result).toBe(AuthorizeResult.ALLOW);
    expect(auditor.result).toBe(AuthorizeResult.DENY);
  });

  it('denies create for a pure auditor but allows an admin+auditor', async () => {
    const auditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/platform-auditors']),
    );
    const adminAuditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith([
        'group:default/platform-auditors',
        'group:default/platform-admins',
      ]),
    );
    expect(auditor.result).toBe(AuthorizeResult.DENY);
    expect(adminAuditor.result).toBe(AuthorizeResult.ALLOW);
  });

  it('honors configured admin/auditor group sets', async () => {
    const custom = new PlatformPermissionPolicy(
      ['group:default/sre', 'group:default/platform-admins'],
      ['group:default/readonly'],
      { getEntities: async () => ({ items: [] }) } as any,
      { getOwnServiceCredentials: async () => ({}) } as any,
      noopLogger,
    );
    // a member of a configured admin group is not blocked even if also readonly
    const sreReadonly = await custom.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/sre', 'group:default/readonly']),
    );
    const readonly = await custom.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/readonly']),
    );
    expect(sreReadonly.result).toBe(AuthorizeResult.ALLOW);
    expect(readonly.result).toBe(AuthorizeResult.DENY);
  });

  it('allows unrelated permissions (read) for anyone', async () => {
    const res = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestRead),
      userWith([]),
    );
    expect(res.result).toBe(AuthorizeResult.ALLOW);
  });

  describe('catalog.entity.read', () => {
    const READ = { permission: catalogEntityReadPermission } as never;

    it('lets an admin read everything', async () => {
      const policyAdmin = makePolicy();
      await expect(
        policyAdmin.handle(READ, userWith(['group:default/platform-admins'])),
      ).resolves.toEqual({ result: AuthorizeResult.ALLOW });
    });

    it('gives a non-admin a conditional decision, never a bare ALLOW', async () => {
      // A bare ALLOW here is the bug this whole task exists to prevent.
      const d = await makePolicy({}).handle(
        READ,
        userWith(['group:default/payments']),
      );
      expect(d.result).toBe(AuthorizeResult.CONDITIONAL);
    });

    it('lets an owner through by entity ownership', async () => {
      const d: any = await makePolicy({}).handle(
        READ,
        userWith(['group:default/payments']),
      );
      expect(JSON.stringify(d.conditions)).toContain('IS_ENTITY_OWNER');
    });

    it('lets a service-owner through by resource-type annotation', async () => {
      // checkout owns the git-resource template, so it must see every
      // git-resource even when it owns none of them directly.
      const d: any = await makePolicy({
        templates: [tpl('git-resource', 'group:default/checkout')],
      }).handle(READ, userWith(['group:default/checkout']));
      const json = JSON.stringify(d.conditions);
      expect(json).toContain('platform.io/resource-type');
      expect(json).toContain('git-resource');
    });

    it('does not narrow anything that is not a platform Resource', async () => {
      // Templates, Groups, Users and Components must keep today's behaviour, or
      // the scaffolder and the org sidebar break. Asserted by applying the real
      // rules to real entities, not by walking the criteria tree: `not:
      // hasAnnotation(...)` and a bare `hasAnnotation(...)` both contain
      // 'platform.io/resource-type' in their JSON, and a shape assertion is
      // happy either way — which is exactly how a Template lockdown shipped
      // once already.
      const d = await makePolicy({}).handle(
        READ,
        userWith(['group:default/nobody']),
      );
      expect(d.result).toBe(AuthorizeResult.CONDITIONAL);
      expect(isVisible(d, entity('Group'))).toBe(true);
      expect(isVisible(d, entity('Component'))).toBe(true);
      // an un-annotated Resource is not one of ours either
      expect(isVisible(d, entity('Resource'))).toBe(true);
    });

    it('leaves a Template visible even though it carries the annotation', async () => {
      // The annotation is authored ON TEMPLATES — it is how a Template declares
      // which resource type it provisions, so every seeded template has one.
      // Only `kind: Resource` may be narrowed; a `not: hasAnnotation` clause
      // alone hides every template from every non-owner, which empties /create
      // and 404s the scaffolder's own getEntityByRef.
      const d = await makePolicy({
        templates: [tpl('git-resource', 'group:default/checkout')],
      }).handle(READ, userWith(['group:default/payments']));

      expect(
        isVisible(
          d,
          entity('Template', {
            resourceType: 'git-resource',
            ownedBy: 'group:default/checkout',
          }),
        ),
      ).toBe(true);
    });

    it('still hides a Resource of a type the user neither owns nor services', async () => {
      const d = await makePolicy({
        templates: [tpl('git-resource', 'group:default/checkout')],
      }).handle(READ, userWith(['group:default/payments']));

      expect(
        isVisible(
          d,
          entity('Resource', {
            resourceType: 'git-resource',
            ownedBy: 'group:default/checkout',
          }),
        ),
      ).toBe(false);
    });

    it('still ALLOWs non-catalog permissions', async () => {
      const d = await makePolicy({}).handle(
        { permission: { name: 'something.else' } } as never,
        userWith([]),
      );
      expect(d.result).toBe(AuthorizeResult.ALLOW);
    });
  });
});
