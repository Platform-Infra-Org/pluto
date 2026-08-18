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

## Dependent selects

Five fields can cascade over one API call that returns a whole hierarchy,
rather than each level having its own endpoint. `provision-database` is the
worked example:

```yaml
parameters:
  - properties:
      space:
        type: string
        title: Space
        ui:field: DynamicSelect
        ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates }
      network:
        type: string
        title: Network
        ui:field: DynamicSelect
        ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space] }
      region:
        type: string
        title: Region
        ui:field: DynamicSelect
        ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space, network] }
      island:
        type: string
        title: Island
        ui:field: DynamicSelect
        ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space, network, region] }
      environment:
        type: string
        title: Environment
        ui:field: DynamicSelect
        ui:options: { proxyPath: /infra/coordinate-tree, treePath: coordinates, dependsOn: [space, network, region, island] }
```

The endpoint at `treePath` returns the whole hierarchy in one call — nested
objects keyed by name, four levels deep, with a sorted array of leaf values
(e.g. environment names) at the bottom:

```json
{
  "coordinates": {
    "prod": {
      "core": {
        "eu-west": { "mgmt": ["dev", "prod"], "paris": ["prod"] },
        "us-east": { "ashburn": ["dev"] }
      }
    }
  }
}
```

Two rules:

- `dependsOn` lists the sibling field names that are this level's ancestors,
  **outermost first**. It is explicit rather than inferred from form order, so
  reordering fields on the template never silently breaks the cascade.
- Changing a parent clears any child whose current value the new branch does
  not contain — a value that survives an ancestor change would point at a
  coordinate nobody can resolve. A field is disabled with a "Pick `<parent>`
  first" placeholder until every field it `dependsOn` has a value.

All five levels share one request to the same `proxyPath` (cached for 30s) —
five fields asking the same endpoint for the same tree is not five fetches.

## Notes

- Options refresh on `intervalMs`; the current selection is preserved across
  refreshes, and the last good list is kept if a refresh fails. (`intervalMs`
  is ignored once `treePath` is set — the cascade re-derives its options from
  the cached tree instead of polling.)
- The field is registered by the `platform-ui` plugin
  (`platformScaffolderFieldsModule`) — no per-template setup beyond `ui:field`.
