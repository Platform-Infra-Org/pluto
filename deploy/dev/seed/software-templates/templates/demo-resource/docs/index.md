# Demo Resource template

Requests a demo resource and tracks it to completion.

## What happens when you run it

1. You pick a **Name** and a **Region** (fetched live via a `DynamicSelect`
   field through the backend proxy).
2. The `platform:request:submit` action files a **request** (pending approval)
   on your behalf.
3. An approver reviews it. On approval, an Argo workflow provisions the
   resource — submitted exactly as described by the step's `argoSubmit` block.
4. The request stays open until the workflow finishes, then flips to
   SUCCEEDED / FAILED.

## Customising the Argo submit

The `argoSubmit` block in the template's submit step controls everything sent
to Argo: `namespace`, `workflowTemplate`, `entrypoint`, `parameters`, `labels`,
and more. String values support `<< token >>` templating (`requestId`,
`resourceName`, `resourceType`, `requester`, `paramsJson`, `params.<field>`),
resolved by the backend at submit time. The `<< >>` delimiter is distinct from
Scaffolder's `${{ }}`, so tokens need no escaping. Omit `argoSubmit` for the
default behavior.

See **Provision Database** for a fuller example.
