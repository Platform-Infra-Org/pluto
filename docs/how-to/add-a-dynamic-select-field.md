# How to add a live (DynamicSelect) field

`DynamicSelect` is a Scaffolder form field that fetches its options from an API on
an interval — useful for regions, sizes, or anything that changes.

## Use it in a template

```yaml
parameters:
  - properties:
      region:
        type: string
        title: Region
        ui:field: DynamicSelect
        ui:options:
          proxyPath: /demo-options/regions   # routed through the Backstage proxy
          intervalMs: 30000                   # refresh every 30s
```

The API response can be either shape:

- a **list** — `["small","medium","large"]` → each value is a choice;
- a **map** — `{"US East":"us-east-1","EU West":"eu-west-1"}` → keys are labels,
  values are the submitted values.

## Authenticated upstreams: use the proxy

Set `proxyPath` (not `url`) so the call goes through the **Backstage proxy**,
which injects the upstream's auth **server-side** — secrets never reach the
browser. Define the endpoint in `app-config.yaml`:

```yaml
proxy:
  endpoints:
    '/demo-options':
      target: https://your-api.internal/options
      headers:
        Authorization: Bearer ${OPTIONS_API_TOKEN}
```

Use `url:` (direct) only for public, unauthenticated endpoints.

## Notes

- Options refresh on `intervalMs`; the current selection is preserved across
  refreshes, and the last good list is kept if a refresh fails.
- The field is registered by the `platform-ui` plugin
  (`platformScaffolderFieldsModule`) — no per-template setup beyond `ui:field`.
