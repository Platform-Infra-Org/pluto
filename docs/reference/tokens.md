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
| `<< ownerGroup >>` | the owning service team's entityRef, from the Template's `spec.owner`; `''` when no owning template was found |
| `<< paramsJson >>` | the whole `params` object as a JSON string |
| `<< params.<field> >>` | one named param value |
| `<< resourceData >>` | the resource's current data JSON (update/delete); `{}` if absent/empty |
| `<< resourceData.<field> >>` | one field of the resource data |
| `<< resourcePath >>` | the resource's catalog file path in Git (for `git-ops` delete) |
| `<< resourceDataPath >>` | the resource's data-file path in Git (for `git-ops` update/delete) |
| `<< resourcesJson >>` | every resource the request acts on, as `[{name, path, dataPath, data, owner, title}]` — **one element for a single-resource request**, several for a bulk one |
| `<< secretName >>` | the per-request Kubernetes Secret's name, for the WorkflowTemplate to `secretKeyRef`; `''` when the request declares no secrets |
| `<< entityJson >>` | the resource's whole catalog entity as JSON; `{}` for CREATE |
| `<< entity.<path> >>` | one field of that entity, by dotted path |

Unknown tokens and missing fields resolve to an empty string (`resourceData` to
`{}`). `resourcePath` / `resourceDataPath` are resolved from the resource's
location + its `resource-data` ref, so they're correct for any layout.

`<< ownerGroup >>` is the same value the approval gate is enforced on, so a
workflow that labels, notifies or charges by team names the team that actually
approved the change. It is empty exactly when the request is admin-only — no
owning Template matched its `resourceType` — and a workflow that cannot act
without an owner should fail on the empty string rather than invent one.

`<< resourcesJson >>` is an array in every case, including a single-resource
request — one resource is a batch of one. That is what lets a template use the
same `argoSubmit` and the same workflow entrypoint for the delete button and the
bulk delete, instead of maintaining one workflow that takes four scalars and a
second that takes an array. It is `[]` only for CREATE, which has no resource to
resolve yet.

The scalar tokens are still populated from the first resource, so
`<< resourceData >>`, `<< resourcePath >>` and `<< resourceDataPath >>` keep
working unchanged — `verb-update` uses them and needs no migration.

Each element's `data` is a **nested object**, not a JSON string.

`title` is the resource's `metadata.title`, verbatim, and `''` when it declares
none — so `{{item.title}}` reads without a conditional, the same rule `owner`
follows. It is **display text and nothing else**: a workflow uses it to say
*"Deleting Orders Database (primary)"* instead of *"Deleting 8f14e45f"*. `name`
remains the only key anything may resolve, delete, or build a path from. Titles
are not unique and are not what the catalog is keyed on, so a workflow that
acted on a title would act on the wrong resource, or on none.

`owner` is the resource's own `spec.owner`, verbatim, and `''` when it declares
none. It is **not** `<< ownerGroup >>`: that is the team that owns the
*template*, which is who may approve the request. This is who owns the resource
being acted on — per element, because a batch can span owners, which is exactly
when a workflow needs to notify or tag them separately.

That is worth stating because the intuition points the wrong way. Argo
substitutes `{{item.data}}` inside a JSON string context, so a *string* field
has its quotes escaped and reaches the container as
`{\"region\":\"eu-west-1\"}` — which cannot be piped to `jq`. An object field is
serialized properly and arrives as clean JSON. Note this differs from
`<< paramsJson >>` and the single-resource `data` parameter, which really are
strings; the difference is the `withParam` loop, not the token.

If any resource in a bulk request cannot be resolved, the submit **fails**
rather than passing an element with empty data. A workflow that decommissions
from `data` would otherwise skip the real teardown for that one resource and
delete its files anyway, reporting success.

## `<< entity.<path> >>` — anything the named tokens don't cover

The named tokens are the fields a workflow usually wants. When it wants one
they don't cover, `entity` is the whole catalog entity, exactly as the catalog
parsed it — no backend change needed to reach one more field.

```yaml
argoSubmit:
  parameters:
    system: "<< entity.spec.system >>"
    kind: "<< entity.kind >>"
    dataRef: "<< entity.metadata.annotations.platform.io/resource-data >>"
```

- **Dotted keys work.** `metadata.annotations.platform.io/resource-data` finds
  the key `platform.io/resource-data`; the path is matched longest-key-first at
  each level, not split blindly on `.`.
- **A sub-object renders as JSON**, so `<< entity.metadata.annotations >>` is a
  usable parameter. (The older `params.` / `resourceData.` tokens still use
  plain `String()`, where an array renders as `a,b` — unchanged, so nothing
  relying on that shape moves under it.)
- **It is the resource's entity, not the template's.** Empty for CREATE, which
  has no resource yet, and populated from the *first* resource of a bulk
  request. `<< resourcesJson >>` elements deliberately do not carry the whole
  entity — that would bloat every bulk workflow's parameters.
- Prefer a named token where one exists (`<< resourceData >>`,
  `<< resourcePath >>`): those resolve the `resource-data` ref and the git
  layout for you, which reading the raw entity does not.

## Params reach Argo without any token

Every entry in the request's `params` is sent to Argo as **its own named
parameter** — `size` arrives as `{{workflow.parameters.size}}`, not as a field
to dig out of a JSON blob. Nothing has to be listed in `argoSubmit.parameters`
for that to happen.

| Value | Sent as |
|---|---|
| a string | as-is |
| a number / boolean | `String(v)` — `30`, `true` |
| an object / array | `JSON.stringify(v)` |
| `null` / `undefined` | **not sent at all** |

A blank optional field is *absent*, never `''` — so the WorkflowTemplate's own
declared default applies, which an empty string would silently override.

A param name containing `=`, whitespace or a newline **fails the submit**, naming
the offending param. Argo parses `submitOptions.parameters` as `k=v` strings, so
such a name would not be rejected — it would be silently misparsed.

### Precedence, and turning it off

```yaml
argoSubmit:
  forwardParams: false          # default: true
  parameters:
    data: "<< paramsJson >>"
```

`argoSubmit.parameters` is merged **over** the forwarded params, so naming one
there overrides the forwarded value of the same name. `forwardParams: false`
sends only what `parameters` states — for a workflow like `git-ops`, which takes
the whole param set as one `data` blob and declares none of the request's own
fields.

**A template must now declare the parameters it receives.** There is no implicit
`request` parameter any more; a workflow that used to read
`{{inputs.parameters.request}}` declares the fields it actually uses instead.
`<< paramsJson >>` still works when you write it explicitly.

## The three templating layers (don't confuse them)

| Layer | Syntax | Resolved by | Where |
|---|---|---|---|
| Scaffolder form | `${{ parameters.x }}` | Scaffolder (nunjucks) | the template's form/steps |
| Platform submit | `<< paramsJson >>` | the platform backend | the `argoSubmit` block |
| Argo runtime | `{{inputs.parameters.x}}` | Argo | inside the WorkflowTemplate |
