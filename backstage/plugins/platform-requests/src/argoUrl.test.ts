import { argoWorkflowUrl } from './argoUrl';

describe('argoWorkflowUrl', () => {
  it('builds the workflow URL', () => {
    expect(argoWorkflowUrl('https://argo.example', 'argo', 'wf-1')).toBe(
      'https://argo.example/workflows/argo/wf-1',
    );
  });

  it('does not double the slash when the configured URL ends in one', () => {
    expect(argoWorkflowUrl('https://argo.example/', 'argo', 'wf-1')).toBe(
      'https://argo.example/workflows/argo/wf-1',
    );
  });

  // Each of these is a case the request page renders as plain text.
  it.each([
    ['no configured UI', undefined, 'argo', 'wf-1'],
    ['an empty configured UI', '', 'argo', 'wf-1'],
    ['no namespace', 'https://argo.example', undefined, 'wf-1'],
    ['no workflow yet', 'https://argo.example', 'argo', undefined],
  ])('is undefined with %s', (_why, uiUrl, namespace, name) => {
    expect(argoWorkflowUrl(uiUrl, namespace, name)).toBeUndefined();
  });
});
