# How to run the production image locally

`yarn start` runs the dev build. Some bugs only exist in the production one —
anything that depends on a hashed MUI class name, a dev-only export, or a file
the bundle does not carry. This runs the **real image** against the same dev
stack, on the same URL.

```bash
bash scripts/backstage-up.sh      # once: Postgres, Keycloak, Gitea, LDAP, kind + Argo
bash scripts/prod-image-up.sh     # build the image, run it on :7007
```

Then open <http://localhost:7007> — the backend serves the frontend, so there is
no :3000 in this flow. Re-run the script after a code change; it rebuilds and
replaces the container.

```bash
docker logs -f platform-prod
docker rm -f platform-prod        # stop; the dev stack keeps running
```

## What it actually runs

`packages/backend/Dockerfile`, unmodified — the same image `build:all` and CI
produce. Two configs are mounted over the baked-in `app-config.yaml`:

| Mounted | Why |
|---|---|
| `backstage/app-config.local.yaml` | your generated dev secrets, same file `yarn start` uses |
| `deploy/dev/container-prod.yaml` | rewrites every dependency's address for a container |

It is **not** `app-config.production.yaml`: that one points the catalog at
Bitbucket and drops Gitea, neither of which exists on a laptop. The goal is
production *build* semantics against dev *infrastructure*.

## Why every host is `host.docker.internal`

`localhost` inside a container is the container. Postgres, Gitea, Keycloak, LDAP
and the port-forwarded argo-server all run on the host, so the overlay addresses
them as `host.docker.internal`.

Keycloak is the one that bites if you shortcut it. It runs `start-dev` with no
`KC_HOSTNAME`, so it derives its issuer and endpoints from the request's `Host`
header — reach it as `keycloak:8081` from the container and the *browser* gets
redirected to a name it cannot resolve. `host.docker.internal` resolves from
both sides, which is why it is used even where a container name would connect.

`app.baseUrl` stays `localhost:7007`: that is the redirect URI registered in the
dev realm, and the browser reaches the container on the published port.

## Secrets are off in this flow

`platform.secrets.enabled: false` in the overlay, and this is the one behaviour
that does not match production.

The Secret store reaches the Kubernetes API through the SDK's default credential
chain — an in-cluster ServiceAccount token, or a kubeconfig. This container has
neither: it is a plain `docker run` *beside* the kind cluster, not a Pod in it,
and kind's kubeconfig points at `127.0.0.1:<random>`, which inside a container is
the container.

Left enabled, the symptom is quiet and misleading: the 15-minute sweep fails
every tick, and a request declaring a secret fails at submit — *after* approval,
which is the expensive place to discover it. Disabled, the request is refused
up-front with `needs secrets but platform.secrets is disabled`.

To exercise secrets, run the backend on the host with `yarn start`, which picks
up your kubeconfig. See
**[Secret lifecycle](../explanation/secrets-lifecycle.md)**.

## When the build fails on disk space

The image is ~1.5 GB and every rebuild leaves the previous one dangling, so a
few iterations fill the Docker VM. The build fails with `ENOSPC` /
`no space left on device`:

```bash
docker image prune -f && docker builder prune -f
```

**Not `--volumes`.** The dev stack's Postgres, Gitea and Keycloak state lives in
Docker volumes; pruning those is what `backstage-down.sh` is for, and it is not
what you want mid-iteration.

Check Postgres before assuming the build was the only casualty — a full disk can
take it down mid-write, and it will not come back on its own:

```bash
docker ps -a | grep postgres      # "Exited (1)" means look at its logs
docker start backstage-postgres-1 # replays WAL once there is space again
```
