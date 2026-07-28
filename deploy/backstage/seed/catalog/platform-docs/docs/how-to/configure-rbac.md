# How to configure admins & per-team approval

## Who can approve a request

Two independent checks decide an approval:

- **The gate** (who may approve at all): a **platform admin**, or a member of the
  request's **owning team** (the owner of the template for that `resourceType`).
- **The policy** (how many approvals): `SINGLE` (one) or `N_OF_M` (n distinct).

## Choose which groups are admins / auditors

Set the group lists in `app-config.yaml`. Multiple groups may map to each:

```yaml
platform:
  rbac:
    adminGroups:
      - group:default/platform-admins
      - group:default/sre            # e.g. add another admin group
    auditorGroups:
      - group:default/platform-auditors
```

- **Admins** approve anything and see all requests.
- **Auditors** are read-only (cannot create or approve).
- Everyone else is scoped to their own + their team's requests.

Defaults (if unset): `platform-admins` and `platform-auditors`.

## Make a team a service owner

A team owns a resource type by owning its **template**:

```yaml
# in the template
spec:
  owner: group:default/checkout
```

Now members of `checkout` (and admins) can approve create/update/delete requests
for that type — and only them. Groups and memberships come from **LDAP** (see
**[Identity & LDAP](../explanation/identity-and-ldap.md)**); add a user to the
group in the directory to grant them approval rights.

## Require more than one approval

Set a policy on the request. Today only the API sets it directly:

```bash
curl -X POST .../api/platform-requests/requests \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kind":"CREATE","resourceType":"my-thing","resourceName":"x",
       "requester":"sam","policy":{"mode":"N_OF_M","n":2}}'
```

`N_OF_M` needs `n` **distinct** approvers, each of whom must pass the gate.

## What the request page shows

The **Requests** page has three tabs — **My requests**, **For approval** (pending
items you can decide), and **All requests** (admins: everything; owners: their
teams'). Approve/Reject only appear when you're allowed to decide.
