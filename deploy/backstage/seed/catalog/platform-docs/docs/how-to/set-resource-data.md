# How to give a resource a data file

A resource's data (the JSON shown on the **Resource Data** tab, and available to
update/delete workflows as `<< resourceData >>`) is referenced by an annotation,
the same shape as `backstage.io/techdocs-ref`.

## The annotation

```yaml
# on a Resource entity
metadata:
  annotations:
    platform.io/resource-data: dir:./my-resource-data.json
```

The ref supports:

| Form | Meaning |
|---|---|
| `dir:<relative>` | a JSON/YAML file **next to** this entity's file (resolved against its location) |
| `url:<absolute>` | any URL the backend reader is allowed to fetch (host in `backend.reading.allow`) |
| `<relative>` (bare) | treated as `dir:` |

Both JSON and YAML parse. If the ref is absent, the tab falls back to
`spec.resourceData`; if that's absent too, the data is `{}`.

## Where the file lives

For a resource created by the `git-ops` workflow, the file is committed for you
(`resources/<name>-data.json`) and the annotation is written automatically. For a
hand-seeded resource, drop the file next to its `catalog-info.yaml` and point the
ref at it (see `orders-db` in the catalog seed for a worked example).

## Editing the data

The **Manage resource → Edit** dialog loads the resolved data, lets you change its
scalar fields, and files an UPDATE request. On approval the `git-ops` update
workflow rewrites the data file **in place** — the backend resolves the file's
real path from the annotation (`<< resourceDataPath >>`), so it works whether the
resource is flat or in a subdirectory.

## `url:` refs are read-mostly

A `url:` ref pointing outside the catalog Git repo can be **viewed** but not
reliably rewritten by `git-ops` (it only writes the catalog repo). Prefer `dir:`
for resources you intend to edit.
