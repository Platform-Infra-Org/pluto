# Platform requests backend

This backend plugin stores requests, enforces approval rules, starts and polls
Argo workflows, and publishes Backstage notifications.

## Approval ownership

At request creation, the backend resolves the matching Scaffolder Template and
uses its `spec.owner` as `ownerGroup`. That captured owner controls initial
approval authorization and the team shown by the frontend. This keeps approval
wording generic: changing a Template owner changes new requests without a code
change.

An Argo suspend node may declare
`workflows.argoproj.io/approver-group: group:<namespace>/<name>`. That group is
allowed to answer the node and is returned as `approverGroup` for the frontend's
`Awaiting input from <team>` status. Unannotated nodes use the established
owner/admin fallback described in the request lifecycle documentation.

## Notifications

`src/notifications.ts` sends native Backstage notifications for:

- a new request that needs approval;
- a suspended workflow step that needs input;
- an approval or rejection; and
- workflow completion or failure.

Approval notifications resolve the requester through the Catalog and render
User `spec.profile.displayName`. If the User entity or profile is unavailable,
the notifier formats the stored technical name as a safe fallback. Team and
step labels are similarly formatted from entity refs and workflow node names;
no display label is hardcoded for a specific team.

Notification delivery is best effort. A Notifications service failure is
logged and never changes the request state or blocks a workflow operation.

## Installation

The app registers the plugin from `packages/backend/src/index.ts`:

```ts
backend.add(import('@internal/backstage-plugin-platform-requests-backend'));
```

## Verification

From the `backstage/` directory:

```bash
yarn tsc
yarn test plugins/platform-requests-backend
yarn backstage-cli config:check --strict
```

See `docs/explanation/request-lifecycle.md`,
`docs/how-to/configure-rbac.md`, and `docs/how-to/add-a-review-gate.md` for the
full state and authorization model.
