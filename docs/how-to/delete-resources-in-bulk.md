# How-to: delete several resources in one request

One request, one approval, one workflow — for any number of resources of a
single kind.

## Use it

Open **Create → Delete Git Resources (bulk)**, pick the resources, submit. You
get one request listing every name, in `PENDING_APPROVAL` like any other.

Approval is unchanged: the owner of the template for that resource type, or an
admin. That is why the picker is restricted to one kind — a batch has one
`resourceType`, so it has one owning team.

## Author one for your own resource type

Two pieces. First, a `MultiEntityPicker` filtered to your type:

```yaml
  parameters:
    - title: Resources to delete
      required: [resources]
      properties:
        resources:
          title: Resources
          type: array
          ui:field: MultiEntityPicker
          ui:options:
            catalogFilter:
              kind: Resource
              spec.type: my-resource-type
```

`MultiEntityPicker` is a built-in Scaffolder field — nothing to register.

Second, a submit step passing `resourceNames` and the array token:

```yaml
  steps:
    - id: submit
      action: platform:request:submit
      input:
        resourceType: my-resource-type
        resourceNames: ${{ parameters.resources }}
        kind: DELETE
        argoSubmit:
          namespace: argo
          workflowTemplate: git-ops
          entrypoint: bulk-delete
          parameters:
            resources: "<< resourcesJson >>"
```

`resourceNames` accepts the picker's entityRefs directly; the action reduces
them to bare names.

**Do not put `platform.io/resource-type` on the bulk template.** That annotation
is how the backend finds the *owning* template for a resource type. Two
templates claiming the same type makes owner resolution — and therefore who may
approve — depend on catalog ordering.

## Loop it in the workflow

```yaml
    - name: bulk-delete
      parallelism: 1
      inputs:
        parameters: [{name: resources}, {name: repoUrl}, {name: creds}]
      steps:
        - - name: delete-one
            template: delete
            withParam: "{{inputs.parameters.resources}}"
            arguments:
              parameters:
                - { name: name, value: "{{item.name}}" }
                - { name: data, value: "{{item.data}}" }
```

`parallelism: 1` is required, not tuning: each iteration commits and pushes the
same branch, and concurrent pushes lose the race.

`{{item.data}}` arrives as clean JSON, so a step can pipe it straight to `jq`.
That depends on `data` being a nested object in the array rather than a JSON
string: Argo substitutes into a JSON string context, so a string field would
arrive with its quotes escaped as `{\"region\":\"eu-west-1\"}`.

## What you see

One node per resource in the workflow graph, so a failure names the resource
that failed. The request mirrors the workflow phase as always — if one
iteration fails the workflow fails and the request is `FAILED`, with the earlier
iterations already applied. Deletion is not transactional; the graph is the
record of how far it got.

## Related

- **[Reference → Submit tokens](../reference/tokens.md)** — `<< resourcesJson >>`
- **[How-to → Set resource data](set-resource-data.md)** — where each resource's
  `data` comes from
