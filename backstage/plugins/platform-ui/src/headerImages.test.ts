import { resolveHeaderImages } from './headerImages';

const BUNDLED = { 'template-headers': ['/static/a.1.png', '/static/b.2.jpg'] };

describe('resolveHeaderImages', () => {
  it('uses the bundled folder by default', () => {
    expect(resolveHeaderImages({}, BUNDLED)).toEqual(BUNDLED['template-headers']);
  });

  it('lets config pick another bundled folder', () => {
    expect(resolveHeaderImages({ dir: 'other' }, { other: ['/static/c.png'] })).toEqual([
      '/static/c.png',
    ]);
  });

  it('explicit urls win over the bundled folder', () => {
    expect(
      resolveHeaderImages({ images: ['/branding/headers/x.jpg'] }, BUNDLED),
    ).toEqual(['/branding/headers/x.jpg']);
  });

  it('ignores an empty override rather than blanking the headers', () => {
    // A ConfigMap key that exists but is empty must not silently remove the
    // built-in art — that reads as a broken deploy, not as a choice.
    expect(resolveHeaderImages({ images: [] }, BUNDLED)).toEqual(
      BUNDLED['template-headers'],
    );
  });

  it('drops entries that are not same-origin paths', () => {
    // The CSP is img-src 'self' data:, so a remote URL would be blocked and
    // render as a missing header rather than an error.
    expect(
      resolveHeaderImages({ images: ['https://evil.example/x.png', '/ok.png'] }, BUNDLED),
    ).toEqual(['/ok.png']);
  });

  it('returns an empty array when nothing is available', () => {
    expect(resolveHeaderImages({ dir: 'missing' }, BUNDLED)).toEqual([]);
  });
});
