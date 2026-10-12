# Platform requests frontend

This plugin provides the Home, Requests and Request detail pages for the
platform request lifecycle.

## User-facing request information

- Pending requests show `Pending approval by <team>`. The team is the
  Scaffolder Template `spec.owner` captured by the request backend; no team
  name is hardcoded in the frontend.
- Suspended Argo steps show `Awaiting input from <team>`. The team comes from
  the workflow node's `workflows.argoproj.io/approver-group` annotation, with
  the request owner or platform admins used by the backend when the annotation
  is absent.
- Resource types use the matching Template `metadata.title`, and resources use
  their Catalog `metadata.title` when available. Their technical names remain
  in tooltips and links.
- Requesters use the Catalog User `spec.profile.displayName`. The technical
  `metadata.name` is retained as a fallback and in the cell tooltip.

The Catalog lookups are batched in `src/useResourceTitles.ts`. Keep new list
views on those hooks rather than fetching one entity per row.

## Home and navigation

The home page is controlled by `platform.home.sections`. The `teamAction`
section counts `scope=actionable` requests and links to
`/requests?tab=approval`; this includes both initial approvals and suspended
workflow inputs the signed-in user's groups may handle.

The top application bar contains a notification bell backed by Backstage's
Notifications API. Its badge is the unread count and the bell links to
`/notifications`.

## Start over

The Requests table has a dedicated Actions column. Its replay button opens the
same Scaffolder Template with the original request's `params` encoded in the
`formData` query parameter. Fields the template no longer defines are ignored
by Scaffolder, so this remains compatible as templates evolve.

## Styling

Shared typography, responsive card layout, light/dark surfaces and table/action
alignment live in `@internal/plugin-platform-ui` (`src/styles.ts` and
`src/theme.tsx`). Avoid page-local hardcoded colours; use the `--sc-*` tokens so
new UI works in every configured colour scheme.

## Verification

From the `backstage/` directory:

```bash
yarn tsc
yarn test plugins/platform-requests
yarn backstage-cli config:check --strict
```
