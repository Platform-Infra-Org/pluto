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
| `platform.io/resource-type` | string | The resource's type (maps back to its template/owner). **Decides visibility:** admins, the resource's owner, and the type's service-owner may see it; everyone else sees nothing. A Resource without this annotation is not narrowed by the visibility policy. |
| `platform.io/resource-data` | `dir:<rel>` \| `url:<abs>` \| `<rel>` | Ref to the resource's data JSON/YAML file. Rendered on the **Resource Data** tab and resolved as `<< resourceData >>`. Falls back to `spec.resourceData`. |

## On an Argo suspend template

| Annotation | Value | Effect |
|---|---|---|
| `platform.io/approver-group` | group entityRef, e.g. `group:default/finance` | The team that answers **that** suspend step. |

Written on the template's own `metadata.annotations`, not on the workflow:

```yaml
templates:
  - name: approve-cost
    metadata:
      annotations:
        platform.io/approver-group: group:default/finance
    suspend: {}
```

Who may resume a given node, in order:

| Node | Who may resume it |
|---|---|
| No annotation | Admin **or** the request's `ownerGroup` — the original rule, unchanged. |
| Annotation names a group | Admin **or** that group. **`ownerGroup` is not sufficient for this step.** |
| Annotation empty or unresolvable | **Admin only — fail closed.** |

The decision is **per node**, so one workflow can send a cost gate to finance and
a schema gate to DBAs and have each answered by its own team. An unresolvable
group deliberately narrows to admins rather than falling back to the owner: a
typo then becomes a visible stall somebody escalates, never a silently wider
gate. The UI names the group it could not resolve for exactly that reason.

Anyone who can edit a `WorkflowTemplate` can therefore move a gate. That does not
widen the trust boundary — in this architecture the Argo templates are already
the trusted layer, and the `git-ops` template is the single writer of the catalog
repo — but it is worth knowing before it is discovered.

**Where it is read from.** An Argo status node carries `templateName` but not the
template's annotations, so the backend looks the definition back up on the
workflow. Observed against a live argo-server: a step referenced from a
`WorkflowTemplate` leaves `spec.templates` **empty** and the resolved definition
lands in `status.storedTemplates`, keyed
`namespaced/<workflowTemplate>/<template>` with the bare name in `.name`.
Templates written inline on the workflow arrive in `spec.templates` instead. Both
are matched by `.name`, so the key format is never parsed.

## Standard Backstage annotations also used

- `backstage.io/techdocs-ref: dir:.` — TechDocs source (templates, this doc site).
- `backstage.io/managed-by-location` — used by the backend to resolve a
  resource's git path for `git-ops` update/delete.
