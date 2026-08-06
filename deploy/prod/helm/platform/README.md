# platform

Helm chart for the internal developer platform.

Deploys the portal only. Postgres, the directory (AD), SSO and Bitbucket Data
Center are yours; the chart references them and never creates them.

```bash
helm upgrade --install platform deploy/prod/helm/platform \
  --namespace platform --create-namespace \
  -f my-values.yaml
```

Full guide, including the credential keys and the two production traps:
**docs/how-to/deploy-with-helm.md**.

## Quick reference

| Value | Meaning |
|---|---|
| `image.repository` / `image.tag` | defaults to the chart's appVersion |
| `secrets.existingSecret` | Secret holding every credential |
| `secrets.externalSecrets.enabled` | render an ExternalSecret to fill it |
| `postgres.*` | external database (no password here — it comes from the Secret) |
| `oidc.*` / `ldap.*` / `bitbucket.*` | SSO, directory, Git |
| `argo.*` | workflow engine; `proxyPath` keeps the token server-side |
| `platform.*` | RBAC groups, per-request secrets, retention, home page |
| `extraAppConfig` | merged over the generated config, last-wins |

Rendered config is a ConfigMap; the Deployment restarts on its checksum, so a
config-only `helm upgrade` actually rolls the pods.
