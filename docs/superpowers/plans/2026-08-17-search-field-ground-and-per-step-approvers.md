# Search-field ground, and a per-step approver group for suspend gates — Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> **This document is a plan only.** Nothing in it has been implemented.

**Branch:** `feat/search-field-and-team-approvals`, cut from `main` at `7889c9c`.

Two unrelated pieces of work travel together because they were asked for
together. They touch disjoint files and can be done in either order, or in
parallel by two people: Part A is frontend-only (`platform-ui`), Part B is
backend plus a small frontend surface (`platform-common`,
`platform-requests-backend`, `platform-requests`).

---

## Part A — the search field paints the wrong ground

### What is actually wrong

The field on `/create` declares `background: hsl(var(--sc-bg))` while it sits on
a `--sc-card` surface. Wherever a mode gives those two tokens different values,
the box reads as a panel of the wrong colour laid on the card.

Measured on the running app, light register, `/create`, per mode — `d` is the
largest per-channel distance between the field and the surface behind it:

| mode | field | behind it | verdict |
|---|---|---|---|
| claude | `rgb(240,238,230)` | `rgb(250,249,245)` | **mismatch, d=15** |
| papers | `rgb(248,244,241)` | `rgb(255,255,255)` | **mismatch, d=14** |
| spiderverse | `rgb(246,243,233)` | `rgb(253,251,247)` | **mismatch, d=14** |
| foudre | `rgb(255,247,245)` | `rgb(255,255,255)` | **mismatch, d=10** |
| hermes | `rgb(245,245,245)` | `rgb(255,255,255)` | **mismatch, d=10** |
| dairy | `rgb(246,249,249)` | `rgb(255,255,255)` | **mismatch, d=9** |
| obsidian | `rgb(247,247,248)` | `rgb(255,255,255)` | **mismatch, d=8** |
| greek | `rgb(248,246,242)` | `rgb(252,251,248)` | **mismatch, d=6** |
| newform | `rgb(249,251,249)` | `rgb(255,255,255)` | **mismatch, d=6** |
| slush | `rgb(255,255,255)` | `rgb(255,255,255)` | matches |
| discord | `rgb(255,255,255)` | `rgb(255,255,255)` | matches |

**9 of 11.** The two that pass do so by luck — slush and discord happen to set
`--sc-bg` and `--sc-card` to the same white. This was reported for claude,
obsidian and flying papers, which are simply the three largest gaps.

The catalog and search-page fields are unaffected: they are transparent and
inherit whatever they sit on. That is the behaviour to match.

### The decision

A field takes the ground of the surface it sits on. It should not name a page
token while sitting on a card. Two candidate fixes, in preference order:

1. **Transparent, inherit the surface.** What the catalog and search fields
   already do, and correct in every mode by construction — there is no pair of
   tokens left to disagree. The edge and the radius still make it read as a
   field.
2. `hsl(var(--sc-card))` — correct on a card, wrong again the day the control
   is used somewhere that is not a card.

Prefer (1). Take (2) only if the browser shows the transparent field is too
weakly separated from the panel in some mode, and record which mode forced it.

### Tasks

- [ ] **A1 — Find every input that names a ground.** Grep `styles.ts` and the
      five mode sheets for `MuiInput`, `MuiOutlinedInput`, `sc-input` and
      `bui-` field rules that set `background`. The rule this report is about is
      `.sc-route-create [class*="MuiInput-root"]` in `styles.ts`; do not assume
      it is the only one. Record each hit and the surface it sits on.
- [ ] **A2 — Re-ground them.** Apply the decision above. Keep the border, the
      radius and the focus ring exactly as they are — this is a ground change,
      not a restyle.
- [ ] **A3 — Re-measure all 11 modes, both registers.** Drive the built app and
      compare each field against its own effective background. Drive the
      register with `context({ colorScheme })` and never by forcing `.sc-dark`:
      the class is synced to MUI's own palette and forcing it desynchronises
      them and invents failures. Assert the class matches the register asked
      for. The scratch harness used to produce the table above is the starting
      point.
- [ ] **A4 — Guard it.** A `styles.test.ts` case that no field rule declares
      `--sc-bg` as its background. State the reason in the test: a field lives
      on a card, and naming the page token is how these drift apart. A test that
      pins one mode's colour would not have caught this, because the two modes
      that pass do so by coincidence.
- [ ] **A5 — Verify:** `CI=true yarn tsc && CI=true yarn lint:all &&
      CI=true yarn test && CI=true yarn build:all`, from `backstage/`.
      `CI=true` is required or `backstage-cli` sits in watch mode forever.
      `build:all` is not ceremony — `styles.ts` is one template literal, and a
      backslash before digits fails the bundle while `tsc` stays silent.

### Hazards

- `styles.ts` is a single template literal. A stray backtick — **including in a
  comment** — truncates the whole stylesheet. This has now happened three times
  in this repo's history, most recently on 2026-08-17.
- Mode sheets may re-declare the field ground for their own reasons. Fixing the
  base rule alone can leave a mode still wrong; A1 exists to find those.

---

## Part B — a suspend step may name the team that approves it

### Where the gate lives today

One rule serves both approval moments, and it is written twice:

- `stateMachine.ts` `applyDecision` — the initial `PENDING_APPROVAL` decision.
  Admin **or** a member of `request.ownerGroup` (the Scaffolder Template's
  owner). Absent `ownerGroup` ⇒ admin-only.
- `router.ts` `POST /requests/:id/resume` (~line 414) — releasing a waiting
  suspend node. The comment says *"Same gate as approving the request itself:
  whoever may approve may resume"*, and it re-implements that check inline
  against `principalResolver`.

`permission-backend-module-platform-rbac/src/module.ts` is deliberately coarse
and its own comment names this gap: *"Per-team approval … needs the request's
ownerGroup — this policy only knows the permission name."* So the per-team
decision is made in the plugin, not in the permission policy, and that is where
this work goes too.

### The model, as decided

The approver group is declared **per suspend step**, as an annotation on the
Argo suspend template. One workflow can therefore send a cost gate to finance
and a schema gate to DBAs.

```yaml
templates:
  - name: approve-schema
    metadata:
      annotations:
        platform.io/approver-group: group:default/dba
    suspend: {}

  - name: approve-cost
    metadata:
      annotations:
        platform.io/approver-group: group:default/finance
    suspend: {}
```

Resolution for a given suspend node, in order:

| node state | who may resume that node |
|---|---|
| no annotation | admin **or** `request.ownerGroup` — today's behaviour, unchanged |
| annotation present, group resolves | admin **or** the named group. **`ownerGroup` is not sufficient for this step.** |
| annotation present, empty or unresolvable | **admin only — fail closed** |

The owner approves at the start; a named gate belongs to the named team. An
unresolvable group becomes a visible stall someone escalates, never a silently
wider gate — the same instinct as the existing `absent ownerGroup ⇒ admin-only`
rule.

**Authorisation is per node, not per request.** A request may wait on two
suspend steps owned by different teams at once, and each is answered by its own
team. This is the part that makes it more than a config toggle.

### Open question to settle FIRST, in the running app

`suspendedNodesOf` (`argo.ts:251`) reads `wf.status.nodes`. An Argo status node
carries `templateName` but **not** the template's annotations, so the annotation
has to be resolved from the workflow's own template definitions:

- `wf.status.storedTemplates` — Argo's resolved template map, which is where a
  `WorkflowTemplate`-backed step's definition ends up; keys are namespaced and
  need matching against `templateName`.
- `wf.spec.templates[]` — for templates defined inline on the workflow.

Both call sites (`argo.ts:464`, `argo.ts:559`) already have the whole `wf` in
scope, so widening the signature is cheap. **Do not guess the shape.** Submit a
workflow whose suspend template carries the annotation, fetch it from the real
argo-server, and record the actual JSON path before writing the resolver. Which
of the two sources is populated depends on how the template was referenced, and
a `git-ops` step referenced from a `WorkflowTemplate` is the case that matters
here.

### Tasks

- [ ] **B1 — Establish the annotation's JSON path.** Per the open question
      above. Record a real fetched workflow as a fixture; the unit tests should
      run against a shape that was observed, not invented. This task gates B2.
- [ ] **B2 — Carry the group through the read path.** Add
      `approverGroup?: string` to `SuspendedNode` (`platform-common/src/index.ts`,
      ~line 113) and resolve it in `suspendedNodesOf`, widening its signature to
      take the template source found in B1. Keep the function pure and keep its
      existing rules intact — a node is a suspend gate only when
      `type === 'Suspend' && phase === 'Running'`, which no change here may
      weaken.
- [ ] **B3 — Decide the node, not the request.** Extract the gate into one pure,
      tested function, e.g. `mayResumeNode({ isAdmin, groups, ownerGroup,
      approverGroup })`, returning allow/deny plus a reason. Put it beside
      `policySatisfied` in `stateMachine.ts`, which is already the home for pure
      decision logic and, per CLAUDE.md, the cheapest thing in the codebase to
      test. Both the router and the UI must reach the same verdict from the same
      function rather than each re-deriving it.
- [ ] **B4 — Enforce it on resume.** `router.ts` `POST /requests/:id/resume`
      replaces its inline owner check with B3, evaluated **against the node
      being resumed**. The endpoint already re-reads live nodes from Argo before
      acting — keep that, and resolve the group from the live node rather than
      from the stored cache, so a template edit cannot be raced. The denial
      message must name the group that would have been allowed.
- [ ] **B5 — Say so in the UI.** `platform-requests` renders the suspend cards.
      Show which team a gate belongs to, and when the viewer is not in it,
      disable the resume control and say why rather than failing on submit. A
      gate the viewer cannot answer must still be *visible* — that is how they
      know whom to chase.
- [ ] **B6 — Tests.**
      - `stateMachine.test.ts` — the three-state table above, exhaustively:
        no annotation, resolvable, unresolvable/empty. Include the case that
        motivates the whole change: **owner is denied a step that names another
        team**, and an admin is allowed everywhere.
      - `argo.test.ts` — annotation resolved from the B1 fixture; a node with no
        annotation yields `approverGroup: undefined`; existing suspend-detection
        cases still pass untouched.
      - `router.test.ts` — resume denied for the owner on an annotated node,
        allowed for a member of the named group, allowed for an admin, and
        denied for everyone but admins when the group does not resolve.
      - A request waiting on **two** nodes with **different** groups, proving
        the decision is per node.
- [ ] **B7 — Document it.** `docs/reference/annotations.md` gains
      `platform.io/approver-group` with the resolution table.
      `docs/explanation/request-lifecycle.md` is the file CLAUDE.md points at
      for the lifecycle, and its `AWAITING_INPUT` section needs the per-step
      gate. Say plainly that the owning team is *excluded* from an annotated
      step — that is the surprising part, and the part an operator will hit.
- [ ] **B8 — Verify:** the full gate as in A5.

### Risks

- **A workflow author can now name the approving team.** That is the point, but
  it means anyone who can edit a `WorkflowTemplate` can move a gate. In this
  architecture the Argo templates are already the trusted layer — the git-ops
  WorkflowTemplate is the single Git writer — so this does not widen the trust
  boundary. Worth stating in the docs so nobody discovers it later.
- **Fail-closed can stall a workflow.** A typo in a group ref leaves only admins
  able to resume. That is the chosen behaviour and it is the safe direction, but
  B5 is what makes it survivable: the UI has to name the group it could not
  resolve, or the stall is a mystery.
- **The stored `suspendedNodes` list is a cache.** `router.ts` already re-reads
  from Argo before resuming, and the group must be read from that live copy for
  the same reason the node list is.
- **Scope boundary.** This changes who may resume a *suspend step*. It does not
  touch the initial `PENDING_APPROVAL` decision, `policySatisfied`, or the
  `SINGLE`/`N_OF_M` policy. Dual control — requiring the owner *and* the named
  team on one gate — was considered and explicitly not chosen; it would need
  per-node approval records rather than a single resume call, and is a larger
  piece of work if it is ever wanted.

---

## Suggested order

Part A is self-contained and can land first; it is the smaller change and the
one with a user-visible defect behind it.

Part B is gated on **B1**, which needs a real workflow driven against a real
argo-server. Do that before writing any of B2–B4, because the whole read path
depends on which of the two template sources is actually populated.
