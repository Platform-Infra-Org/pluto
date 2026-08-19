import { pickPath, walkTree } from './coordinateTree';

const TREE = {
  coordinates: {
    prod: {
      core: {
        'eu-west': { mgmt: ['dev', 'prod'], paris: ['prod'] },
        'us-east': { ashburn: ['dev'] },
      },
    },
  },
  projects: ['alpha', 'beta'],
};

describe('pickPath', () => {
  it('returns the whole payload when no path is given', () => {
    expect(pickPath(TREE)).toBe(TREE);
  });

  it('descends a dotted path', () => {
    expect(pickPath(TREE, 'coordinates.prod.core')).toEqual(
      TREE.coordinates.prod.core,
    );
  });

  it('returns undefined for a path that does not exist', () => {
    expect(pickPath(TREE, 'coordinates.nope')).toBeUndefined();
  });
});

describe('walkTree', () => {
  const root = TREE.coordinates;

  it('lists the top level when no ancestors are chosen', () => {
    expect(walkTree(root, [])).toEqual(['prod']);
  });

  it('lists children of the chosen ancestors', () => {
    expect(walkTree(root, ['prod', 'core'])).toEqual(['eu-west', 'us-east']);
  });

  it('returns the leaf array verbatim', () => {
    expect(walkTree(root, ['prod', 'core', 'eu-west', 'mgmt'])).toEqual([
      'dev',
      'prod',
    ]);
  });

  it('returns undefined when an ancestor is unset', () => {
    // An empty string is what RJSF holds for an untouched select.
    expect(walkTree(root, ['prod', ''])).toBeUndefined();
  });

  it('returns undefined when an ancestor names a value the tree lost', () => {
    expect(walkTree(root, ['prod', 'core', 'af-south'])).toBeUndefined();
  });

  it('returns undefined for a null node rather than throwing', () => {
    expect(walkTree({ a: null }, ['a', 'b'])).toBeUndefined();
  });

  it('returns an empty list for an empty branch, which is not the same as unset', () => {
    expect(walkTree({ a: {} }, ['a'])).toEqual([]);
  });
});
