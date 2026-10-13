# Platform requests frontend

This plugin provides the Home, Requests and Request detail pages for the
platform request lifecycle.

## User-facing request information

- Pending requests show `Pending approval by <team>`. The team is the
  Scaffolder Template `spec.owner` captured by the request backend; no team
  name is hardcoded in the frontend.
- Suspended Argo steps show `Awaiting Input by <team>`. The team comes from
  the suspend template's `platform.io/approver-group` annotation, with
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

The home page is controlled by `platform.home.sections`. Requests that the
signed-in user's groups may handle are available under the Requests page's
`For approval` tab; this includes both initial approvals and suspended workflow
inputs. Users outside the relevant owner or gate group receive an empty list.
On a 1920×1080 display, Quick actions, Standing requests and Awaiting approval
share the first row; Your resources uses two columns below so both request
tables retain enough width for their Resource and State columns. Its Created
column reads the optional ISO-8601 `platform.io/created-at` Catalog annotation;
older resources without it display an em dash.

The top application bar contains a notification bell backed by Backstage's
Notifications API. Its badge is the unread count and the bell links to
`/notifications`. Notification resource labels come from the matching
Template's `metadata.title`. Suspend notifications describe the gate's actual
approver group even when the recipient is a platform admin.

## Start over

The Requests table has a dedicated Actions column. Its replay button opens the
same Scaffolder Template with the original request's `params` encoded in the
`formData` query parameter. Fields the template no longer defines are ignored
by Scaffolder, so this remains compatible as templates evolve. The action waits
for the Template mapping and performs a full navigation because the Scaffolder
Stepper reads query form data when it mounts.

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
