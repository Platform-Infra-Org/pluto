# payments-primary

The primary PostgreSQL database backing the payments service.

## At a glance

| Property | Value |
| --- | --- |
| Engine | PostgreSQL 16 |
| Size | large |
| Region | eu-west-1 |
| Owner | `group:default/payments` |

## Provisioning

This database is a catalog `Resource`. It is created and changed through the
platform request flow — submit the **Provision Database** template from the
**Create** page, which files a request that an approver reviews before an Argo
workflow provisions the change. See the [runbook](runbook.md) for day-2
operations.
