# How-to: embed a Grafana dashboard

An existing Grafana dashboard can be framed in two places: its own page at
`/dashboard`, and — scoped to that request's own time window — a card on every
request page once it has a workflow run to plot (`IN_PROGRESS`, `SUCCEEDED`,
`FAILED`).

This makes no Grafana API call and needs no Grafana token. It embeds a
dashboard URL in an iframe, nothing more.

## Configure it

```yaml
platform:
  grafana:
    baseUrl: ${GRAFANA_BASE_URL}
    dashboard:
      uid: ${GRAFANA_DASHBOARD_UID}
      slug: ${GRAFANA_DASHBOARD_SLUG}
    theme: dark
    kiosk: true
```

`baseUrl` is frontend-visible config — served to every user — and it doubles
as an origin allowlist: the frame can never point anywhere else. Leave the
whole `platform.grafana` key unset and both mount points render nothing rather
than an empty box.

In the Helm chart, the equivalent is `platform.grafana` in `values.yaml`
(empty by default — see the commented example there).

## Open the CSP

The frame also needs the backend's Content-Security-Policy to allow it:

```yaml
backend:
  csp:
    frame-src: ["'self'", '${GRAFANA_BASE_URL}']
```

`yarn start` serves through the webpack dev server, which applies no helmet —
the iframe will appear to work there regardless of this setting. It only
matters under the production image (`bash scripts/prod-image-up.sh`) or a real
deployment: without it, the browser blocks the frame and the console shows a
CSP violation, even though Backstage's own config looks correct.

In the Helm chart this is templated automatically from
`platform.grafana.baseUrl` — set that value and the `frame-src` override
appears with it; leave it unset and the base image's CSP stands unchanged.

## Grafana's side: `allow_embedding`

Grafana refuses to be framed by default. Set, in Grafana's own config:

```ini
[security]
allow_embedding = true
```

Without it, Grafana sends `X-Frame-Options: deny` and the frame stays blank no
matter what Backstage does — this is a Grafana-side setting, not something
`platform.grafana` can work around.

## Authentication

Backstage never proxies or authenticates the Grafana request — the browser
loads the iframe `src` directly against `baseUrl`, using whatever session
Grafana itself accepts. Pick one:

| Option | Trade-off |
|---|---|
| Anonymous Viewer | Simplest. Anyone who can reach `baseUrl` in their browser can read the dashboard — there is no Backstage-side gate on it. |
| An auth proxy in front of Grafana | Backstage users' identity carries through, but it is another service to run and keep in sync with your IdP. |
| Grafana 11.5+ Shared Dashboards | An unauthenticated URL scoped to one dashboard. Convenient, but genuinely public if Grafana is internet-reachable — treat the URL itself as the credential. |

Cross-site embedding also has a cookie cost: a session cookie sent from an
iframe on a different origin needs `cookie_samesite = none` in Grafana's
config, which weakens Grafana's CSRF posture **for all of Grafana**, not just
the embedded dashboard. Anonymous Viewer and Shared Dashboards both avoid this
because neither relies on a cookie at all.

## See also

- [Prepare for production](prepare-for-production.md) — where `GRAFANA_BASE_URL`
  fits among the other secrets and endpoints to externalise.
