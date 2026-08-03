# Explanation: per-team RBAC

Access control has two independent layers. Keeping them separate is the key idea.

## The gate vs. the policy

- **The gate** answers *who may approve at all*: a platform **admin**, or a member
  of the request's **owning team**. Enforced in the state machine, which has the
  request's `ownerGroup`.
- **The policy** answers *how many* of those allowed approvals are needed: `SINGLE`
  or `N_OF_M`.

A regular user can't approve someone else's team's request even if they're allowed
to approve their own team's — the gate is per-request.

## Service owner = template owner

"Which team owns this?" is answered by **template ownership**. A request's
`ownerGroup` is resolved at creation from the `spec.owner` of the Scaffolder
template for its `resourceType` (matched by the `platform.io/resource-type`
annotation). CREATE, UPDATE and DELETE all resolve the *same* template owner — so
a team that owns a type owns everything done to instances of it.

If no owning template is found, the request is **admin-only** (a safe default).

## Admins and auditors are just groups

There are no elaborate roles. Two configurable group lists
(`platform.rbac.adminGroups` / `auditorGroups`) decide:

- **admin** → bypasses the gate, sees all requests;
- **auditor** → read-only (the permission policy denies create/approve);
- everyone else → scoped to their own + their teams' requests.

Everything else is a **raw group membership** check (`ownerGroup ∈ your groups`),
sourced from LDAP. We deliberately removed a separate "role" indirection because it
was a 1:1 rename of two groups and bought nothing.

## Visibility follows the same rule

`GET /requests` is scoped server-side: admins see everything; others see their own
requests plus requests owned by their teams. The three request tabs (My / For
approval / All) are views over that scoping.

## Where it could go further

Service-owner scope is currently flat per type — any owning-team member can
approve any request for that type. The *designed* `COMPOSITE` policy (in the graph
builder) extends this to require approvals from the owners of the specific
services a composite is built from, in an admin-chosen count/order.
