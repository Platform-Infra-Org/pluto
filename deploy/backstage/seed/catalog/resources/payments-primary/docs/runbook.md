# Runbook

## Resize

Resizing goes through the platform request flow, never by hand:

1. Open **Create → Provision Database** (or the resize template).
2. Pick the new `size`; submit. This files a request.
3. An approver reviews it; on approval an Argo workflow applies the change.
4. The request stays open until the workflow finishes — watch its status page.

## Failover

The standby is in the same region. Failover is automated by the operator; no
manual step is expected during a zone outage.

## Contacts

Owned by `group:default/payments`. Page them for incidents.
