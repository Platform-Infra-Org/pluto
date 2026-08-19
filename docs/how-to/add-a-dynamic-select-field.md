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

All five levels share one request to the same `proxyPath` — five fields asking
the same endpoint for the same tree is not five fetches.

`intervalMs` works here too, and it is shared the same way: one timer and one
request for the whole cascade, however many levels are reading it. Every level
is handed the same snapshot from the same response, so a refresh can never
leave one field offering an island that its parent's tree no longer contains.
If levels disagree about the interval, the most eager one wins; when the last
level unmounts, the timer stops. A refresh that fails keeps the last good tree
and leaves the form usable, exactly as a flat field does.

Note that polling can clear a selection: if a refresh removes the coordinate
someone had chosen, the field is emptied rather than left naming something that
no longer exists.

A level that resolves to exactly **one** value is filled in for you, and the
cascade continues to the next. One option is not a choice, and in a chain it
compounds: a space with a single network, region and island would otherwise be
four clicks that could never have gone differently. It only ever fills an empty
field, so a value you picked yourself is never overwritten — and it applies to a
plain (non-`treePath`) field too, when its endpoint returns a single option.

## Try it against the dev stack

`templates/coordinate-demo` (**Coordinates (demo)** on the Create page) wires all
five levels against a tree the platform backend serves itself, so the cascade is
clickable without an external API:

```yaml
ui:options: { proxyPath: /demo-options/coordinate-tree, treePath: coordinates }
```

It needs `platform.demoOptions: true` — the demo option sets are off unless
asked for (see **Reference → Configuration**), and `scripts/backstage-up.sh`
turns them on in the gitignored `app-config.local.yaml` it writes. Without it
the field reports that it could not load its options, and the route says which
key to set.

Three things are worth doing in that form, because each is a behaviour the
plain example cannot show:

- Pick `aurora` → `core` → `eu-west`, then switch the region. The island and
  environment below it clear, because their values no longer exist on the new
  branch.
- Pick `borealis` → `lab`. That branch has one region and one island, so both
  fill themselves and you land on the environment in a single click.
- Watch the network tab: five fields, one request.

The only difference from a real deployment is where the tree comes from —
`proxyPath` points at the demo route here and at the config API
(`/infra/coordinate-tree`) there. The field cannot tell them apart.

## Notes

- Options refresh on `intervalMs`; the current selection is preserved across
  refreshes, and the last good list is kept if a refresh fails. (`intervalMs`
  is ignored once `treePath` is set — the cascade re-derives its options from
  the cached tree instead of polling.)
- The field is registered by the `platform-ui` plugin
  (`platformScaffolderFieldsModule`) — no per-template setup beyond `ui:field`.
