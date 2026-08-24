import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render', async () => {
    process.env = {
      NODE_ENV: 'test',
      APP_CONFIG: [
        {
          data: {
            app: { title: 'Test' },
            backend: { baseUrl: 'http://localhost:7007' },
            techdocs: {
              storageUrl: 'http://localhost:7007/api/techdocs/static/docs',
            },
          },
          context: 'test',
        },
      ] as any,
    };

    const rendered = render(App.createRoot());

    await waitFor(() => {
      expect(rendered.baseElement).toBeInTheDocument();
    });
  });

  // Regression for the app-config.yaml trap fixed in 83eb0c1: platform-ui's
  // `appLayout` module extension registers under the built-in id `app/layout`,
  // so a module override already replaces the built-in in place — a `false`
  // entry under `app.extensions` disables the *replacement* along with it,
  // leaving `app/root` with no children. "should render" above can't catch
  // this: its APP_CONFIG omits `app.extensions` entirely, so the fatal line
  // is never exercised, and its only assertion (`baseElement` is in the
  // document) holds even when nothing rendered.
  //
  // The bug only shows up *after* sign-in — the sign-in page itself sits
  // outside `app/root`'s children, so it renders identically whether
  // `app/layout` is disabled or not (verified directly: asserting on the
  // sign-in button does not fail against the injected line below). Catching
  // it means getting past the sign-in gate, which means faking the OIDC
  // refresh call and the couple of API calls the nav shell makes on mount —
  // jsdom has no backend, so `fetch` is stubbed by hand for the few endpoints
  // that matter rather than pulling in a mock server.
  //
  // The assertion is that the sidebar landmark CustomNav renders
  // (`<aside aria-label="Main">`, plugins/platform-ui/src/CustomNav.tsx) —
  // that's exactly the thing `app/layout` is responsible for mounting, so its
  // absence *is* the bug, not a proxy for it. `findByRole` polls (unlike a
  // fixed `setTimeout`), which is what makes this deterministic instead of a
  // race against the app's own async startup.
  //
  // This test resolves its own fresh `App` (see the comment further down,
  // by `jest.resetModules()`) rather than reusing the module-level one
  // "should render" already used — proven order-independent by running with
  // this test both before and after "should render".
  it('renders the nav shell once signed in, with app.extensions configured', async () => {
    // jsdom has neither: SchemeRoot's effects touch both and would otherwise
    // throw and mask the real assertion behind an unrelated error toast.
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      // The one call PlatformSignInPage needs to resolve as "already signed
      // in", so the render gets past the gate to the app/layout-owned shell.
      if (url.includes('/auth/oidc/refresh')) {
        return json({
          providerInfo: {
            idToken: 'fake-id-token',
            accessToken: 'fake-access-token',
            scope: 'openid profile email',
            expiresInSeconds: 3600,
          },
          backstageIdentity: {
            token: 'fake-backstage-token',
            identity: {
              type: 'user',
              userEntityRef: 'user:default/test',
              ownershipEntityRefs: ['user:default/test'],
            },
            expiresInSeconds: 3600,
          },
        });
      }
      // The nav shell's own on-mount calls (pending-approval count, etc.).
      if (url.includes('/platform-requests/requests')) return json([]);
      if (url.includes('/platform-requests/maintenance')) {
        return json({ enabled: false });
      }
      // Catch-all for the catalog and anything else touched while mounting
      // the routed home page — its own content isn't what's under test here.
      return json({ items: [] });
    });

    process.env = {
      NODE_ENV: 'test',
      APP_CONFIG: [
        {
          data: {
            app: {
              title: 'Test',
              extensions: [
                { 'page:catalog': { config: { path: '/catalog' } } },
                {
                  'catalog-filter:catalog/kind': {
                    config: { initialFilter: 'resource' },
                  },
                },
                { 'theme:app/light': false },
                { 'theme:app/dark': false },
                { 'entity-card:catalog-graph/relations': false },
                { 'page:catalog-graph': false },
                // Proof this fails against the bug it names: uncomment the
                // line below and this test fails (nav never mounts), because
                // it disables platform-ui's `appLayout` replacement along
                // with the built-in it stands in for. Re-run with it removed
                // and the test passes again. See the commit message on
                // 83eb0c1 and the comment by `app/layout` in app-config.yaml.
                // { 'app/layout': false },
              ],
            },
            backend: { baseUrl: 'http://localhost:7007' },
            techdocs: {
              storageUrl: 'http://localhost:7007/api/techdocs/static/docs',
            },
          },
          context: 'test',
        },
      ] as any,
    };

    // Force a fresh `App` (and a matching fresh react-dom, so the root it
    // mounts isn't a different React copy than the one that built the tree)
    // so this test resolves its own extension tree instead of inheriting
    // another test's — see the comment above. `App.createRoot()`'s
    // `LazyApp` (`@backstage/frontend-defaults`) is a `React.lazy` whose
    // loader — the thing that reads `process.env.APP_CONFIG` and resolves
    // extensions — runs and memoizes on first render, for the lifetime of
    // that `LazyApp` closure; a fresh module instance is the only way to get
    // a fresh one. `@testing-library/react` itself can't be re-required the
    // same way — its module top level registers `beforeAll`/`afterAll`
    // cleanup hooks, which jest-circus refuses mid-test — so this renders
    // with a freshly required `react-dom/client` directly and queries the
    // resulting DOM with the top-level `screen`/`waitFor`, which are
    // `@testing-library/dom` re-exports with no React coupling of their own.
    jest.resetModules();
    const ReactDOMClient = require('react-dom/client') as
      typeof import('react-dom/client');
    const FreshApp = (require('./App') as typeof import('./App')).default;

    const container = document.createElement('div');
    document.body.appendChild(container);
    ReactDOMClient.createRoot(container).render(FreshApp.createRoot());

    expect(
      await screen.findByRole(
        'complementary',
        { name: /main/i },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  }, 10000);
});
