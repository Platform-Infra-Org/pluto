# How to author a software template

Goal: add a new requestable resource type by writing a Scaffolder template that
files a request and submits an Argo workflow.

## 1. Create the template file

Add `templates/<name>/template.yaml` to the software-templates repo. The minimum:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: my-thing
  title: My Thing
  annotations:
    platform.io/resource-type: my-thing          # ties requests back to this template
  # verb-update / verb-delete annotations enable edit/delete (see below)
spec:
  owner: group:default/<team>                     # THIS team owns approvals
  type: resource
  parameters:
    - title: Details
      required: [name]
      properties:
        name: { type: string, title: Name }
        size: { type: string, title: Size, default: small }
  steps:
    - id: submit
      action: platform:request:submit
      input:
        resourceType: my-thing
        resourceName: ${{ parameters.name }}
        kind: CREATE
        params:
          size: ${{ parameters.size }}
        resultOutput: resource-ref                # workflow output → linked on the request
        argoSubmit:
          namespace: argo
          workflowTemplate: git-ops               # the shared create/update/delete workflow
          entrypoint: create
          parameters:
            name: "<< resourceName >>"
            type: "my-thing"
            owner: "group:default/<team>"
            data: "<< paramsJson >>"
  output:
    links:
      - title: Open request
        url: /requests/${{ steps.submit.output.requestId }}
```

Two templating layers meet here — keep them straight:
`${{ parameters.x }}` is **Scaffolder** (form input); `<< token >>` is resolved by
**the backend at submit time**. See **[Submit tokens](../reference/tokens.md)**.

## 2. Enable edit & delete

Add verb annotations so the resource's **Manage resource** card works. They point
at `git-ops` update/delete and pass the paths the backend resolves for you:

```yaml
metadata:
  annotations:
    platform.io/resource-type: my-thing
    platform.io/verb-update: '{"argoSubmit":{"namespace":"argo","workflowTemplate":"git-ops","entrypoint":"update","parameters":{"name":"<< resourceName >>","dataPath":"<< resourceDataPath >>","data":"<< paramsJson >>"}},"resultOutput":"resource-ref"}'
    platform.io/verb-delete: '{"argoSubmit":{"namespace":"argo","workflowTemplate":"git-ops","entrypoint":"delete","parameters":{"name":"<< resourceName >>","path":"<< resourcePath >>","dataPath":"<< resourceDataPath >>"}}}'
```

## 3. Set the owner = the approving team

`spec.owner` is the **service owner**: only that group (or an admin) can approve
create/update/delete requests for this type. Use a real LDAP group. See
**[Configure RBAC](configure-rbac.md)**.

## 4. Publish + pick it up

Commit the template to the software-templates repo, then register/refresh:

```bash
bash deploy/backstage/gitea-seed.sh          # push the repo
# then refresh the templates Location:
curl -X POST .../api/catalog/refresh -d '{"entityRef":"location:default/platform-templates"}'
```

Your type now appears under **Create**.

## Prefer not to hand-write it?

Use the **Service Builder** UI — it generates a standards-compliant template
(owner, `resource-type` annotation, `argoSubmit`, verb annotations) from a form.
