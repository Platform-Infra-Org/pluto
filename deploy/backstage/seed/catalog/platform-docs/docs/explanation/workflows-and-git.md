# Explanation: workflows own Git

A defining decision: **the Argo workflow is the only thing that writes the catalog
Git repo at runtime.** The Backstage backend never mutates Git for provisioning.

## Why

- **One writer, one audit trail.** Every change to a resource is a workflow run
  with a commit — not a side effect of a backend process. You can see exactly what
  changed and when, in Git history.
- **The backend stays a control plane.** It records intent (the request) and reads
  status back; it doesn't hold provisioning logic. That keeps it simple and makes
  the *workflow* the place to put real provisioning (call a cloud API, then commit
  the resulting catalog entry).
- **It's how production works anyway.** In a real deployment the provisioning step
  *is* a workflow; making the demo do the same avoids a backend shortcut that
  wouldn't exist in prod. (An earlier `catalogWriter` backend shortcut was removed
  for exactly this reason.)

## `git-ops`: one workflow, three verbs

A single `git-ops` WorkflowTemplate has `create` / `update` / `delete`
entrypoints. Every resource type's template points its `argoSubmit` (create) and
`verb-*` annotations (update/delete) at it:

- **create** — commit `resources/<name>.yaml` (a Resource entity with a
  `platform.io/resource-data: dir:./<name>-data.json` ref) + the data file, and
  register it in `catalog-info.yaml`.
- **update** — rewrite the data file in place.
- **delete** — remove both files and unregister.

## The backend resolves the paths

`git-ops` doesn't assume a layout. The backend resolves a resource's real git
paths — `<< resourcePath >>` (its catalog file) and `<< resourceDataPath >>` (its
data file, from the `resource-data` ref) — from the entity's location, and passes
them in. So a resource in a subdirectory, or with a custom data-file name, is
updated/deleted correctly.

## The result comes back by output

The workflow emits the created resource ref as a **global** Argo output
(`globalName: resource-ref`); the backend reads it on success and links it on the
request. Global (not node-local) is the contract — a plain container output stays
on the node otherwise.
