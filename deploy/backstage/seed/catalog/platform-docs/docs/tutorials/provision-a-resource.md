# Tutorial: Provision your first resource

By the end of this tutorial you will have requested a resource, approved it, and
watched an Argo workflow create it in the catalog — the whole platform loop, once.

This is a **learning** exercise on the local dev stack. It assumes the stack is
running (`docker compose … up -d`, `kind-argo-up.sh`, `yarn start`).

## 1. Sign in

Open the app and sign in with an LDAP account — use **`sam` / `sam`**. Sam is a
member of the `checkout` team, which owns the resource type you'll create.

## 2. Make a request

1. Go to **Create** and choose **Git Resource**.
2. Give it a **Name** (e.g. `hello`), pick a size/region, and **Create**.
3. You land on the request page. Its state is **PENDING_APPROVAL** — nothing has
   been provisioned yet.

Behind the scenes: running the template filed a *request* on your behalf; it did
**not** touch any infrastructure. That only happens after approval.

## 3. Approve it

Because you're `sam` and the `git-resource` template is owned by your `checkout`
team, you can approve your own request:

1. On the request page, click **Approve**.
2. The state moves to **IN_PROGRESS** and you get a notification: *"approved —
   workflow running."*

The backend has now submitted an Argo workflow, labelled with this request's id.

## 4. Watch it finish

The request page polls Argo. Within a few seconds:

- The state becomes **SUCCEEDED**.
- A green banner appears: **"✓ Created resource: hello"**, linking to the new
  catalog entity.

The `git-ops` workflow committed `resources/hello.yaml` (+ its data file) to the
catalog Git repo and emitted the resource name as an output, which the backend
read and linked.

## 5. See what you made

Follow the link (or open **Catalog → hello**). On the resource page:

- **Resource Data** tab — the resource's data JSON, as a collapsible tree.
- **Manage resource** card — **Edit** / **Delete**, which file *new* requests
  (each running the workflow's `update`/`delete` entrypoint).

## What you learned

- A template run creates a **request**, not a resource.
- Approval is **per-team** — you could approve because you own the type.
- The **workflow** does the real work and writes Git; the request just tracks it.

Next: **[Author a software template](../how-to/author-a-template.md)** to add your
own resource type.
