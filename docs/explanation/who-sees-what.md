# Explanation: who sees a resource, and who may delete it

Resource visibility and delete authority are guarded by the same logic, enforced
at the catalog layer — the backend's permission policy and the router's pre-flight
check, never by the picker alone. The two are different enough that conflating them
is the mistake this design cuts off.

## Two owners

Every Resource carries `spec.owner` — who the thing belongs to. The Scaffolder
template for that resource type also carries `spec.owner` — who approves changes
to *that type*. They are resolved independently and may differ.

- **owner** = `spec.owner` on the Resource itself. Who manages this instance.
- **service-owner** = `spec.owner` on the Template for this resource type (matched
  via `platform.io/resource-type` annotation). Who approves CREATE/UPDATE/DELETE
  for any instance of that type.

Confusing them is the trap this policy was built to avoid. A service-owner can
delete every resource of their type; a resource owner can delete only their own.

## Who may see a resource

The catalog's read gate admits:
- Platform **admins** (any resource, always).
- The resource's **owner** (`spec.owner`).
- The resource type's **service-owner** (the template's `spec.owner`).

Everyone else sees nothing. Only `kind: Resource` is narrowed, and only when it
carries a `platform.io/resource-type` annotation — this is a gate on
platform-managed resources, not a catalog lockdown. Templates, Groups, Users,
Components and everything else behave exactly as before. The kind check is
what does that work, not the annotation: the annotation is authored **on
templates** too (it is how a Template declares which resource type it
provisions), so gating on the annotation alone would hide most of `/create`
from everyone who is not a template owner.

The gate is enforced on **every** read: home page, entity page, search, picker,
graph. The MultiEntityPicker does not apply visibility itself; it reads the
catalog with the requester's credentials, so the policy narrows it automatically.

### The one read that is not the catalog's

`GET /resources/:name/data` (the Resource data tab, and the prefill behind the
edit/delete actions) is ours, not the catalog's. It resolves a resource through
`resolveResource`, which reads the entity with the **backend's own service
credentials** — it has to, because the provisioning path shares it and runs
without a user. That makes it the one read where "the catalog filters
everything" would otherwise stop being true.

So the route re-asks the catalog *as the caller* before it answers, and treats
"the catalog returned nothing" as not-found. That is deliberately not a fourth
copy of the ownership rule: asking the catalog is the same question by
construction, and this design has already twice paid for two copies of an
authorization rule drifting apart.

It answers **404, never 403**. A 403 confirms the resource exists, which is
itself the leak on a route whose job is hiding it — invisible and absent have to
be indistinguishable from outside. Service principals skip the check: they are
the provisioning path, and have no user whose visibility could be tested. If the
gate is unwired, or the catalog cannot be reached, every user gets 404 — an
unwired gate must not be an open one.

## Who may bulk-delete

The bulk-delete `POST /requests` endpoint checks the same union before submitting
any workflow:

- Platform **admin** → allowed.
- **Every named resource's own owner** → allowed (owner of the specific instance).
- The resource type's **service-owner** → allowed (owner of the type).

Anyone else is 403'd. The check runs before the request is created, and **the
refusal is atomic**: if the requester cannot delete one or more of the named
resources, the whole request fails and nothing is created. Partial success was
rejected deliberately — on an action that submits a Git-writing workflow, a
half-created request is the outcome hardest to notice and hardest to undo. The
error **names the offending resources** — every name the requester may not
delete, not just the first — along with the resource type and the reason
(admin/owner/service-owner required). Naming only the type would tell the user
nothing: every name in a batch is of the same type, so it could not point at
which of five ticked boxes stopped the request.

## Why the two owners grant different reach

A resource owner can delete *their own* resources — every resource named in the
request must be one of theirs, or the whole request is refused. A service-owner
can delete **every** resource of the type they own the template for, without
owning any instance directly. The intuition: a service team owns the machinery,
so it may act on anything built from it; the customer owns only what they asked
for. Both are real delete authority, they just have different reach, and
`mayDeleteLookup` in the requests backend checks them as two separate branches
of the same union.

## The visibility limits

The gate uses **direct `memberOf` group membership only**, resolving a named
requester's groups by querying the catalog and walking the `relations`. On a
Keycloak→LDAP stack with nested groups, a user who is an owner only by
inheritance (member of a member of the owning group) will be able to *see* the
resource — because the permission policy uses `ownershipEntityRefs`, which Backstage
itself resolves transitively — but will be refused (403) when attempting
bulk-delete. It fails closed. A user in this situation will not be silently denied
without explanation; the 403 error message spells out what is required. If
nested-group ownership needs to apply to bulk-delete as well, the backend's
`mayDeleteLookup` would need to walk `relations` transitively (or use the same
`principalResolver` the permission policy uses for `ownershipEntityRefs`).

## The picker is a courtesy

The bulk-delete form's entity picker is narrowed for free — a user with no
visibility gets an empty picker. But the picker is not the gate; `POST /requests`
is. If a picker issue ever narrows the list incorrectly while leaving the backend
open, it is a UX issue, not a security issue. The backend check always comes last.
