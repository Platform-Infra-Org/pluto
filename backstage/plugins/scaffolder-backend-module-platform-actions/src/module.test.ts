import { resourceNamesFrom } from './module';

describe('resourceNamesFrom', () => {
  it('strips the kind and namespace off an entityRef', () => {
    expect(resourceNamesFrom(['resource:default/bucket-a'])).toEqual([
      'bucket-a',
    ]);
  });

  it('passes a bare name through', () => {
    expect(resourceNamesFrom(['bucket-a'])).toEqual(['bucket-a']);
  });

  it('handles a mix and preserves order', () => {
    expect(
      resourceNamesFrom(['resource:default/b', 'a', 'resource:prod/c']),
    ).toEqual(['b', 'a', 'c']);
  });

  it('drops empties and de-duplicates', () => {
    expect(
      resourceNamesFrom(['resource:default/a', 'a', '', '  ']),
    ).toEqual(['a']);
  });
});
