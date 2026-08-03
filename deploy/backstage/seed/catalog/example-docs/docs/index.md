# ACME Billing (vendor)

We operate this application but do not own its source, so there is nowhere to
add an `mkdocs.yml` next to the code. The documentation lives **here**, in the
catalog repo, and TechDocs builds it from this directory.

This is the pattern to copy for any third-party or closed-source application:

```text
catalog/
  example-docs/              <- one directory per external app
    catalog-info.yaml        <- the Component entity, techdocs-ref: dir:.
    mkdocs.yml
    docs/
```

The entity describes the vendor app; the docs beside it are ours. `spec.links`
points at the vendor's own documentation, so the two are one click apart.

## What belongs here

Operational knowledge the vendor's manual will never have: how *we* deploy it,
who owns it, which of our resources it depends on, what to do at 3am. Leave the
product manual to the vendor and link it.
