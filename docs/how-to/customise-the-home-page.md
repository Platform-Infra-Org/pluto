# How-to: customise the home page

The home page is a list of cards in config. Reorder them, drop the ones you do
not want, and the page follows.

## Choose the cards

```yaml
platform:
  home:
    title: Welcome to Platform
    subtitle: Your resources and open requests at a glance
    sections:
      - quickActions
      - ownedResources
      - standingRequests
      - pendingApprovals
      - recentlyVisited
      - favouriteTemplates
    maxItems: 8
```

`sections` is an explicit list, so **a card missing from it is not rendered**.
That includes new cards after an upgrade: add the key or it will not appear.

| Section | Shows |
|---|---|
| `quickActions` | links, plus the **Take the tour** button |
| `ownedResources` | catalog resources owned by your groups |
| `standingRequests` | your requests still in flight |
| `pendingApprovals` | requests you may decide |
| `recentlyVisited` | pages you opened, newest first (5) |
| `favouriteTemplates` | templates you starred on New Request (6) |
| `pluto` | decoration — the planet, filling the grid's spare cell. Says nothing, links nowhere |

Order in the list is the order on the page. Cards are all one size, so a row
stays aligned however many you enable; `standingRequests` deliberately takes
two cells because its table is the widest.

## Recently visited and favourites

Neither needs enabling beyond the section key.

- **Recently visited** records a page about a second after you land on it,
  deduped by path so a page you bounce through repeatedly does not crowd out
  others. Home itself and the sign-in handshake are not recorded.
- **Favourite templates** reads the same stars the Create page already writes.
  Star a template there and it appears here; there is no separate favourites
  list to maintain.

Both are stored **per user** in the user-settings backend, not in the browser,
so they follow the person to another machine. That requires
`@backstage/plugin-user-settings-backend` in the backend (it is registered by
default in `packages/backend/src/index.ts`).

## The quickstart tour

The tour runs **once per user** and can be replayed from **Take the tour**,
beside the page title.

It is versioned rather than a boolean: raising `QUICKSTART_VERSION` in
`plugins/platform-ui/src/quickstart/steps.ts` offers a materially changed tour
again, exactly once, without a migration.

Steps are data in the same file:

```ts
{
  id: 'requests',
  selector: '.sc-nav-item[href="/requests"]',
  title: 'Requests are the record',
  body: 'Every request waits for an approver, then runs a workflow…',
}
```

A step whose `selector` matches nothing is **skipped** rather than shown
framing empty space, with a warning in development. If you restyle something a
step points at, that is where you will hear about it.

## Change what the catalog opens on

Not home, but the same kind of change — the catalog defaults to Component and
this platform is mostly Resources:

```yaml
app:
  extensions:
    - catalog-filter:catalog/kind:
        config:
          initialFilter: resource
```

See **[Configuration keys](../reference/configuration.md)** for the rest of the
filter extensions, which work the same way.
