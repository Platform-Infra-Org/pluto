# Graph Builder in Backstage — Design

Status: design / brainstormed 2026-07-26. Replaces the form-based Service Builder
(`platform-builder*`) with the **graph-based composable builder** originally designed in
[`planning/11-composable-service-builder.md`](../../../planning/11-composable-service-builder.md)
(§4–§8 of that doc define the graph model, big-JSON runtime, Jinja schema, WorkflowTemplate output,
and function-block catalog — this doc does not repeat them). The focus here is the **Backstage
integration** and how everything **fits the current platform standards**, plus the **new
graph-derived approval model**.

Legend: **[std]** = conforms to an already-shipped convention · **[new]** = new in this design.

---

## 1. Goal

Let a service owner compose a service — its request shape *and* its workflow — by wiring **function
blocks** (`fn-api-call`, `fn-json-extractor`, `fn-jinja-render`, …) and **service blocks** (existing
onboarded services = dependencies) on a canvas. On build, the platform generates the `build-json.j2`
Jinja schema + a single combined Argo **WorkflowTemplate** per supported verb, publishes a Scaffolder
template that submits it, and requests of the new type flow through the existing approval + Argo
tracking machinery — under an approval policy an admin sets when approving the build.

## 2. Scope

**In (first cut):**
- Pure TypeScript **generator** (`graph → {build-json.j2, WorkflowTemplate}`), ported from the
  golden-tested `apps/bff/app/generator/*` with the §6/§7 contracts preserved.
- **All three verbs** — create / update / delete. Each is an independently composed graph (opt-in
  subset, ≥1). The generator emits one WorkflowTemplate with a `spec.templates` entry per defined verb.
- **React Flow graph editor** (canvas + palette + inspector + live preview) built on `@xyflow/react`
  and `platform-ui` shadcn components.
- **COMPOSITE approval policy** [new] — admin sets count / which graph services / order when
  approving a build; rides on the existing `request.policy` + state machine.
- **`BUILD` request kind** [new] — owner submits a build; an admin approves it (setting the policy);
  the publisher runs on approval.
- Reuses the existing seeded `fn-*` WorkflowTemplates.

**Out (later phases):** block-onboarding UI (v1 blocks are seeded read-only) · pin-until-migrated
versioning · drift detection · build-time inlining of dependencies (recursion stays by `templateRef`).

## 3. Architecture (fits the plugin suite)

| Plugin | Change |
|--------|--------|
| `platform-builder-backend` | Add `src/generator/{graph,waves,jinjaGen,argoGen}.ts` (+ golden `*.test.ts`); a read-only **block registry** seeding v1 `fn-*` manifests; extend router to accept a graph and a build-approval config; publisher unchanged in shape. |
| `platform-builder` (frontend) | Replace form `BuilderPage` with a `@xyflow/react` canvas editor (palette / canvas / inspector / live-preview), same visual language as `RelationsGraph`. |
| `platform-requests-backend` | Extend the **state machine** for `COMPOSITE` policy; add a **`policyResolver`** (sibling to `ownerResolver`) that reads the template's approval-policy annotation; add the `BUILD` request kind. |
| `platform-common` | `ApprovalPolicy` gains the `COMPOSITE` variant; `RequestKind` gains `BUILD`. |

No new runtime or service — all TypeScript, hot-reloads with the backend. [std]

## 4. Data model

- **Block manifest** (planning §3) as a TS type; v1 built-ins seeded in the backend. Block-onboarding
  UI deferred.
- **Graph** (planning §4): `Node{ id, block, kind: main|dependency|internal, action?, inputBindings,
  outputs }`; edges implied by `node.<id>.outputs.*`; DAG-validated at save.
- **Service blocks = existing catalog Templates** [std]: the palette lists onboarded platform
  Templates. A service block's typed IO derives from the Template's `parameters` (inputs) plus a
  `platform.io/outputs` annotation (outputs). A dependency compiles to
  `templateRef:{ name:<service>, template:<verb> }` — recursion by reference (planning §5/§7).
- **ServiceDefinition** carries `graphs:{ create?, update?, delete? }` and the generated
  `{ workflowTemplateYaml, buildJsonJ2 }` (regenerated on save).

## 5. Generator (pure, ported, golden-tested)

Three templating layers are kept strictly separate — this is the core "fit standards" requirement:

| Layer | Syntax | Resolved by | Lives in |
|-------|--------|-------------|----------|
| Scaffolder form | `${{ parameters.x }}` | Scaffolder (nunjucks) | generated `template.yaml` |
| Submit resolver [std] | `<< paramsJson >>` | backend `resolveTemplate` (argo.ts) | the `argoSubmit` block |
| Composable runtime | `{{ request.x }}` + `<<path>>` | `fn-jinja-render` at runtime | inside `build-json.j2` |

They never intersect: `build-json.j2` is a **literal string parameter** on a WorkflowTemplate task, so
`resolveTemplate` never sees its `<<path>>` tokens. The doc/code comments call this out explicitly so
the two `<< >>` uses are not confused. The `<<path>>` runtime placeholder convention is unchanged from
planning §6 (it is internal to `fn-jinja-render`).

Per verb, the emitted template is a DAG `render-0 → waves → render-N → main-call` (planning §7),
dependencies invoked by `templateRef`. The generator is deterministic and golden-tested against the
ported §6/§7 corpus.

## 6. Generated Scaffolder template = current standards [std]

The composite type publishes a `template.yaml` shaped exactly like today's generated/hand-written
ones:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: <service>
  title: <Title>
  tags: [platform, <category?>]
  annotations:
    platform.io/resource-type: <service>          # per-team approval resolution [std]
    platform.io/approval-policy: '<json>'          # baked at build-approval [new]
    platform.io/outputs: '<json>'                  # declared outputs (for use as a service block)
spec:
  owner: group:default/<creating-team>             # creating service owner [std]
  type: resource
  parameters: [ ... request fields ... ]
  steps:
    - id: submit
      action: platform:request:submit              # [std]
      input:
        resourceType: <service>
        resourceName: ${{ parameters.name }}
        kind: CREATE
        params: { <field>: ${{ parameters.<field> }}, ... }
        argoSubmit:                                 # [std] << token >> delimiter
          namespace: argo
          workflowTemplate: <service>              # the composite WorkflowTemplate
          entrypoint: create
          parameters: { request: "<< paramsJson >>" }
          labels: { platform.io/requested-by: "<< requester >>" }
  output:
    links: [{ title: Open request, url: /requests/${{ steps.submit.output.requestId }} }]
```

The composite WorkflowTemplate takes a single `request` param (planning §7), so the `argoSubmit`
passes `request: << paramsJson >>` — the standard minimal submit. Update/delete templates are emitted
only for the verbs the owner composed; the resource edit/delete entity card [std] files `UPDATE`/
`DELETE` requests whose `argoSubmit.entrypoint` targets the matching verb.

## 7. Graph editor UI

`@xyflow/react` canvas (dark + dots, accent-highlighted nodes — the visual language of `RelationsGraph`
and the workflow DAG) with:
- **Palette** (left): function blocks + service blocks (existing Templates), grouped.
- **Canvas** (center): drag a block → node; connect an output port → input port to wire it. One node
  is flagged `main`.
- **Inspector** (right): per-node input bindings (request field / upstream output / literal), config,
  output names.
- **Verb tabs**: create / update / delete — each edits its own graph; owner toggles which verbs are
  supported.
- **Live preview** tab: the generated `build-json.j2` + WorkflowTemplate, updating as the graph
  changes (the "output to screen" deliverable, planning §9).
Built from `platform-ui` shadcn components; validation errors (cycle, unbound input, type mismatch,
missing/inactive service block) surface on the offending node/edge.

## 8. Approval model [new]

### 8.1 The COMPOSITE policy
A new variant of the existing `ApprovalPolicy`, stored on `request.policy` and enforced by the state
machine (which already handles SINGLE / N_OF_M / RBAC):

```ts
{ mode: 'COMPOSITE',
  creatingOwner: 'group:default/checkout',   // the service being built; always allowed
  creatingOwnerRequired: true,               // default true
  required: [                                // subset of the graph's service blocks
    { service: 'network',  group: 'group:default/net' },
    { service: 'accounts', group: 'group:default/acct' } ],
  count: 2,                                   // how many of `required` must approve
  ordered: false }                           // true = must approve in the listed order
```

- **Gate (who may act on a request):** admin, the `creatingOwner`, or a member of any `required[].group`.
  Anyone else → `NotAllowedError`. [extends the current admin-or-owner gate]
- **Satisfied when:** (`creatingOwner` approved, if `creatingOwnerRequired`) **and** `count` distinct
  `required` services' owners approved. If `ordered`, a required service's owner may approve only once
  all earlier required services have approved (else the decision is rejected as out-of-order).
- Default (admin sets nothing) = **creating owner only** — identical to today's per-team behavior.

### 8.2 Where the admin sets it — the `BUILD` request
- The owner composes + previews, then **submits a build** → creates a **`BUILD`** request carrying the
  graph + generated YAML, `ownerGroup` = the creating team, requiring **admin** approval (RBAC).
- An **admin opens the build request**, reviews the generated WorkflowTemplate + `build-json.j2`, and
  in the approve dialog sets **count / which required services / ordered**. The dialog offers the
  graph's dependency services as the candidate set; their owner groups are resolved from each
  service's Template `spec.owner` at that moment, so `required[].group` is concrete.
- On approval, the **publisher** bakes the resolved policy into the template's
  `platform.io/approval-policy` annotation and publishes the Scaffolder template + WorkflowTemplate
  (publisher remains the only writer; runtime workflow remains the only Git writer at runtime). [std]

### 8.3 Applying the policy to requests of the new type
At request creation, `platform-requests-backend` already resolves `ownerGroup` from the template
(`ownerResolver`). A sibling **`policyResolver`** reads the template's `platform.io/approval-policy`
annotation and sets `request.policy` accordingly (absent → today's `SINGLE` + creating-owner gate).
No change to the submit action or template authoring.

## 9. Error handling & validation

- **Save-time:** DAG acyclicity; every required input bound; type-compatible wires; exactly one
  `main`; referenced service blocks exist and are active; referenced function blocks exist.
- **Generation:** deterministic; invalid graph blocks generation (no partial YAML).
- **Build-approval:** the admin can only pick `required` services that are actually dependency nodes
  in the graph; `count ≤ required.length`.
- **Runtime:** unchanged from planning §11 (failed wave → request FAILED; unresolved `<<path>>` fails
  the render step with a clear message).

## 10. Testing

- **Generator (pure):** golden-file tests for `jinjaGen`/`argoGen` (ported §6/§7 corpus), waves/topo-
  sort, recursion namespacing, all three verbs.
- **COMPOSITE policy:** state-machine matrices — gate (admin / creating owner / required member /
  outsider), `count`, `creatingOwnerRequired`, `ordered` (in-order accepted, out-of-order rejected),
  default = creating-owner-only.
- **policyResolver:** annotation → policy (incl. absent → SINGLE).
- **Editor:** graph edits produce valid graph JSON; live preview reflects the graph; invalid wires
  flagged.
- **Publisher:** bakes the resolved policy annotation; publishes template + WorkflowTemplate.

## 11. Global constraints (standards mapping)

- New frontend/backend systems (Blueprints, `createBackendPlugin`/`Module`). [std]
- Generated templates use `platform.io/resource-type`, `spec.owner` = service owner, `argoSubmit`
  with the `<< token >>` delimiter, `platform:request:submit`, the `/requests/<id>` output link. [std]
- Approval rides on `request.policy` + `ownerGroup` + `ownerResolver` + state machine; the composite
  policy is baked at build-approval and resolved at request creation. [std]
- UI: `@xyflow/react` + `platform-ui` shadcn; follows the color-picker accent. [std]
- Generator is pure/deterministic and golden-tested; the builder only *prints/publishes* templates —
  the runtime workflow stays the sole Git writer. [std]

## 12. Deferred (non-blocking)

- Block-onboarding UI + registry writes (v1 blocks seeded read-only for now).
- Pin-until-migrated versioning + drift detection.
- `secretRef` conventions for `fn-api-call` (name-only; resolved from a cluster Secret at runtime).
