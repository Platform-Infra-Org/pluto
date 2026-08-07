# Reference: submit tokens (`<< >>`)

Inside a template's `argoSubmit` (and the `verb-*` annotations), string values may
contain `<< token >>` placeholders. The **backend** resolves them at submit time,
against the request's runtime context.

The `<< >>` delimiter is deliberately distinct from Scaffolder's `${{ }}`, so the
tokens pass through the template's form rendering untouched and are resolved later
by the platform backend — **no escaping needed**.

## Tokens

| Token | Resolves to |
|---|---|
| `<< requestId >>` | the request's numeric id |
| `<< resourceName >>` | the resource name |
| `<< resourceType >>` | the resource type |
| `<< requester >>` | the requesting user's short id |
| `<< paramsJson >>` | the whole `params` object as a JSON string |
| `<< params.<field> >>` | one named param value |
| `<< resourceData >>` | the resource's current data JSON (update/delete); `{}` if absent/empty |
| `<< resourceData.<field> >>` | one field of the resource data |
| `<< resourcePath >>` | the resource's catalog file path in Git (for `git-ops` delete) |
| `<< resourceDataPath >>` | the resource's data-file path in Git (for `git-ops` update/delete) |
| `<< resourcesJson >>` | bulk requests: a JSON array of every resource, `[{name, path, dataPath, data}]` |

Unknown tokens and missing fields resolve to an empty string (`resourceData` to
`{}`). `resourcePath` / `resourceDataPath` are resolved from the resource's
location + its `resource-data` ref, so they're correct for any layout.

`<< resourcesJson >>` resolves to `[]` for an ordinary single-resource request.
Each element's `data` is itself a **JSON string**, not a nested object, so an
Argo `withParam` loop can substitute `{{item.data}}` unambiguously — the same
shape the single-resource case passes as its `data` parameter.

If any resource in a bulk request cannot be resolved, the submit **fails**
rather than passing an element with empty data. A workflow that decommissions
from `data` would otherwise skip the real teardown for that one resource and
delete its files anyway, reporting success.

## The three templating layers (don't confuse them)

| Layer | Syntax | Resolved by | Where |
|---|---|---|---|
| Scaffolder form | `${{ parameters.x }}` | Scaffolder (nunjucks) | the template's form/steps |
| Platform submit | `<< paramsJson >>` | the platform backend | the `argoSubmit` block |
| Argo runtime | `{{inputs.parameters.x}}` | Argo | inside the WorkflowTemplate |
