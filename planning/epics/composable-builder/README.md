# Composable Service Builder — Implementation Epics

Phased implementation plan for the graph-based, workflow-generating Service Builder designed in
[`../../11-composable-service-builder.md`](../../11-composable-service-builder.md). Each epic is an
independently executable plan (TDD, task-by-task) that produces working, testable software on its own.

> **For agentic workers:** each epic uses `- [ ]` step syntax. Execute with
> `superpowers:subagent-driven-development` (fresh subagent per task + review) or
> `superpowers:executing-plans`. Builds on the existing platform (epics E01–E09) — same repo, stack,
> and conventions.

## Epics & sequencing

| Epic | Title | Depends on | Design § |
|------|-------|-----------|----------|
| [CB01](CB01-block-registry.md) | Function Block registry + manifest schema + v1 built-in seeds + block-onboarding screen | E08 | §2, §3, §8 |
| [CB02](CB02-generator.md) | Generator (pure): `graphs → { build-json.j2, WorkflowTemplate }` | CB01 | §5, §6, §7, §10 |
| [CB03](CB03-graph-editor.md) | Graph editor UI (canvas + inspector + live preview) | CB01, CB02 | §4, §9 |
| [CB04](CB04-onboarding-wiring.md) | Onboarding wiring — per-verb opt-in graphs, editability, admin review, versioning | CB02, CB03, E08 | §4, §7, §10, §14 |
| [CB05](CB05-runtime-blocks.md) | Runtime `fn-*` WorkflowTemplates (jinja-render, api-call, json-extractor, set-value, git-commit) | CB01 | §5, §6, §8 |

## Dependency graph

```
CB01 ─┬─▶ CB02 ─┬─▶ CB03 ─▶ CB04
      │         └───────────┘
      └─▶ CB05 (parallels CB02/CB03; live-Argo deferred)
```

Critical path: **CB01 → CB02 → CB03 → CB04**. CB05 runs in parallel after CB01.

## Global constraints (apply to all CB epics)

- **The builder only *prints* generated templates; it never writes Git.** The runtime workflow
  remains the sole Git writer (per [E06](../E06-execution.md) / design §7).
- **Two roles:** platform-admins onboard function blocks (CB01); `service-owner`s compose graphs
  (CB03/CB04). Authorization enforced server-side.
- **Generator is a pure, deterministic module** (no I/O) — golden-file tested against the design's §6
  Jinja and §7 WorkflowTemplate contracts.
- **Verbs are opt-in and per-verb independent**; definitions are fully re-editable and versioned
  (pin-until-migrated), reusing the E08 onboarding-approval lane (`SERVICE_ONBOARDING`).
- Stack: Python/FastAPI BFF (jinja2, pyyaml, pydantic); React+TS+Vite SPA (React Flow for canvas),
  shadcn/ui + Tailwind; Postgres; Argo (runtime, live-deferred).

## Definition of done (per epic)

All tasks' tests green, ruff/mypy/tsc/eslint clean, and the epic's Exit walkthrough passes. Golden
contracts for the generator (CB02) match design §6/§7 exactly.
