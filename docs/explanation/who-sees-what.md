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

## Where delete authority stops short of visibility

Visibility and delete authority ask **different questions about group
membership**, and on a nested-group directory they can disagree.

- The permission policy (visibility) reads `ownershipEntityRefs`, which Backstage
  resolves **transitively** — your groups *and their ancestors*.
- `mayDeleteLookup` and `adminLookup` (bulk-delete, and the maintenance-mode
  admin check) resolve a named requester by reading their User entity from the
  catalog and filtering `relations` to `memberOf` — **direct membership only**.

They cannot currently ask the same question. Both backend gates run on a resolved
`requester` *string* rather than a credential — the Scaffolder submits as a
service principal and names the human in the body — while `ownershipEntityRefs`
comes from the identity layer, which needs a user credential. All the catalog can
offer for a bare name is direct edges.

So on a Keycloak→LDAP stack with nested groups, a user who owns a resource only
by inheritance (a member of a member of the owning group) **can see it and cannot
bulk-delete it**. It fails closed: the disagreement only ever refuses someone who
should have been allowed, never the reverse. That is why it is a known limit
rather than a hole.

### The failure is badly ordered, and the 403 does not explain it

This is the part worth knowing before someone reports it as a bug. The user is
not stopped early. They get a *full* picker, tick five boxes, submit, and only
then get refused — the most expensive point at which to find out. Worse, the
refusal says admin, owner or service-owner is required, and they **are** the
owner as far as every other screen in the app is concerned. Nothing in the
message points at nested groups.

Until this is closed it is a support question, not a self-service one. Closing it
means walking `relations` transitively in the backend; nothing here does that
yet, and a second hand-rolled group-graph walker beside Backstage's own is
exactly the duplicate-authorization-rule drift this design has twice paid for.

## The picker is a courtesy

The bulk-delete form's entity picker is narrowed for free, because it reads the
catalog with the user's own credentials — no picker code enforces anything.

But the picker is not the gate; `POST /requests` is. That endpoint receives a
plain list of names, and nothing in the payload distinguishes a name chosen from
a filtered dropdown from one typed into `curl`. If the picker ever narrows
incorrectly while the backend stays closed, that is a UX bug. If the backend
check were removed, the narrowing would be decorative. The backend check always
comes last.

Two cases where the picker and the backend legitimately disagree, both of them
late refusals rather than empty pickers:

- a **nested-group owner**, as above;
- a **stale tab**, whose list was loaded before an owner or a group membership
  changed.
