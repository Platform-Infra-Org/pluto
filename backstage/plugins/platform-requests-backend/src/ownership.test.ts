import { mockServices } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { ServiceOwnerMap } from '@internal/plugin-platform-common';
import { createMayDeleteLookup } from './ownership';

/**
 * The gate the router calls before accepting a bulk DELETE. It was previously
 * only ever reached through a router stub that ignored `resourceNames`
 * entirely, so neither the per-resource owner branch nor the service-owner
 * branch had ever run.
 */

/** A User with the given direct `memberOf` groups (all this gate reads). */
const user = (name: string, groups: string[]): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'User',
  metadata: { name, namespace: 'default' },
  spec: {},
  relations: groups.map(targetRef => ({ type: 'memberOf', targetRef })),
});

/**
 * A Resource owned by `owner`, written exactly as the catalog holds it: the
 * verbatim `spec.owner` a human typed, plus the normalised, lowercased
 * `relations.ownedBy` the catalog derived from it — which is what `isEntityOwner`
 * reads when it decides whether the same person may *see* this resource.
 */
const resource = (name: string, owner: string, ownedBy?: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: { name, namespace: 'default' },
  spec: { type: 'git-resource', owner },
  ...(ownedBy === undefined
    ? {}
    : { relations: [{ type: 'ownedBy', targetRef: ownedBy }] }),
});

const ENTITIES: Entity[] = [
  user('dana', ['group:default/payments']),
  user('sam', ['group:default/checkout']),
  user('kim', ['group:default/nobody']),
  resource('orders-db', 'group:default/payments', 'group:default/payments'),
  resource('audit-db', 'group:default/payments', 'group:default/payments'),
  // Written the idiomatic short way. The catalog still resolved it to the
  // payments group, so payments can see it — and must be able to delete it.
  resource('ledger-db', 'payments', 'group:default/payments'),
  resource('billing-db', 'group:default/finance', 'group:default/finance'),
];

// checkout service-owns git-resource; payments owns individual resources.
const SERVICE_OWNERS: ServiceOwnerMap = new Map([
  ['git-resource', 'group:default/checkout'],
]);

const lookup = (opts?: {
  catalog?: CatalogService;
  serviceOwners?: ServiceOwnerMap;
}) =>
  createMayDeleteLookup({
    catalog: opts?.catalog ?? catalogServiceMock({ entities: ENTITIES }),
    auth: mockServices.auth(),
    logger: mockServices.logger.mock(),
    catalogNamespace: 'default',
    serviceOwners: async () => opts?.serviceOwners ?? SERVICE_OWNERS,
  });

describe('mayDeleteLookup', () => {
  it('allows the owner of every named resource', async () => {
    expect(
      await lookup()('dana', 'git-resource', ['orders-db', 'audit-db']),
    ).toEqual({ allowed: true, denied: [] });
  });

  it('refuses when the caller owns only some of the names, and names the rest', async () => {
    // Refused whole: partial success on a Git-writing destructive action is the
    // outcome that is hardest to notice and hardest to undo. The offender is
    // named because every name in the batch is of the same type, so naming the
    // type tells the user nothing.
    expect(
      await lookup()('dana', 'git-resource', ['orders-db', 'billing-db']),
    ).toEqual({ allowed: false, denied: ['billing-db'] });
  });

  it('names every offender, not just the first', async () => {
    expect(
      (await lookup()('kim', 'git-resource', ['orders-db', 'billing-db']))
        .denied,
    ).toEqual(['orders-db', 'billing-db']);
  });

  it('allows the service-owner of the type, whoever owns the resources', async () => {
    expect(
      await lookup()('sam', 'git-resource', ['orders-db', 'billing-db']),
    ).toEqual({ allowed: true, denied: [] });
  });

  it('refuses someone who is neither owner nor service-owner', async () => {
    expect(
      (await lookup()('kim', 'git-resource', ['orders-db'])).allowed,
    ).toBe(false);
  });

  it('allows the owner of a resource whose owner is written short-form', async () => {
    // `owner: payments` is the idiomatic form and the catalog resolves it to
    // group:default/payments, so payments *sees* this resource. Comparing the
    // raw string made the same resource 403 on delete — the exact asymmetry
    // this gate exists to prevent.
    expect(
      (await lookup()('dana', 'git-resource', ['ledger-db'])).allowed,
    ).toBe(true);
  });

  it('allows the service-owner of a template whose owner is written short-form', async () => {
    expect(
      (
        await lookup({
          serviceOwners: new Map([['git-resource', 'checkout']]),
        })('sam', 'git-resource', ['billing-db'])
      ).allowed,
    ).toBe(true);
  });

  it('refuses a name that does not exist in the catalog', async () => {
    expect(
      await lookup()('dana', 'git-resource', ['ghost-db']),
    ).toEqual({ allowed: false, denied: ['ghost-db'] });
  });

  it('fails closed when the catalog cannot be reached, blaming the whole batch', async () => {
    // Nothing was established about any single name, so a shorter list would
    // read as precise and be a guess.
    const broken = {
      getEntityByRef: async () => {
        throw new Error('catalog is down');
      },
    } as unknown as CatalogService;
    expect(
      await lookup({ catalog: broken })('dana', 'git-resource', [
        'orders-db',
        'audit-db',
      ]),
    ).toEqual({ allowed: false, denied: ['orders-db', 'audit-db'] });
  });
});
