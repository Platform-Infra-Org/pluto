# Reference: annotations

`platform.io/*` annotations the suite reads.

## On a Template

| Annotation | Value | Effect |
|---|---|---|
| `platform.io/resource-type` | string | Links requests of this `resourceType` to this template (and thus its owner, for RBAC). Defaults to the template name if absent. |
| `platform.io/verb-update` | JSON `{argoSubmit, resultOutput?}` | The Argo submit config used for **UPDATE** requests of this type. |
| `platform.io/verb-delete` | JSON `{argoSubmit, resultOutput?}` | The Argo submit config used for **DELETE** requests of this type. |
| `platform.io/outputs` | JSON | Declared outputs (for use of the service as a dependency block in the graph builder). |
| `platform.io/approval-policy` | JSON | *(designed)* the composite approval policy baked at build-approval. |

`argoSubmit` string values support **[submit tokens](tokens.md)**.

## On a Resource

| Annotation | Value | Effect |
|---|---|---|
| `platform.io/resource-type` | string | The resource's type (maps back to its template/owner). |
| `platform.io/resource-data` | `dir:<rel>` \| `url:<abs>` \| `<rel>` | Ref to the resource's data JSON/YAML file. Rendered on the **Resource Data** tab and resolved as `<< resourceData >>`. Falls back to `spec.resourceData`. |

## Standard Backstage annotations also used

- `backstage.io/techdocs-ref: dir:.` — TechDocs source (templates, this doc site).
- `backstage.io/managed-by-location` — used by the backend to resolve a
  resource's git path for `git-ops` update/delete.
