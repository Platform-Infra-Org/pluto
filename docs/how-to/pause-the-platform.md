# Pause the platform

Maintenance mode pauses new requests while you work on the platform — catalog changes, secrets rotation, Argo updates, or anything else that needs the request flow offline.

## How it works

The switch lives in **Settings** (admin-only). Flipping it returns a 503 for any non-admin submission — new requests, edits, deletions — **before they submit an Argo workflow**. This gates the only thing that writes the catalog.

Admins can still file during maintenance, which is the point of being able to turn it on without losing the ability to fix things. Work already submitted keeps running; the gate blocks only new submissions.

## What a non-admin sees

The request form at `/create` is replaced by a maintenance page (Pluto in retrograde, a horoscope joke). The form's copy explains it: "New requests are paused while the platform is being worked on. Anything already filed is unaffected."

The `/create/tasks` route remains reachable, so someone can watch a request they already submitted.

On a resource page, *Request update* and *Request delete* open a dialog with the same message rather than submitting into a 503. The dialog is a courtesy; the backend gate is what enforces it — hiding the UI button is not sufficient and is the reason the gate exists.

## The backend gate

This is the load-bearing statement: **the UI hides the form, but the backend refuses the request**. Never trust a control in the browser. Turn maintenance on, a non-admin can still hit the API:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"kind": "CREATE", "resourceType": "example", "resourceName": "test", "params": {}}' \
  https://<your-platform>/api/platform-requests/requests
```

It will answer **503**, because the gate is in code that runs on every caller in the same way. The frontend gate is a screen that stops most users without extra config; the backend gate is what actually enforces it.
