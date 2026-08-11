export interface Config {
  /**
   * Upstream gap, not a platform key.
   *
   * `@backstage/plugin-catalog-backend-module-ldap` 0.12.7 *reads*
   * `catalog.providers.ldapOrg.<id>.schedule` — `readProviderConfigs` feeds it
   * straight to `scheduler.createScheduledTaskRunner`, and the provider throws
   * at startup when neither code nor config supplies one — but its shipped
   * `config.schema.json` never declares it. So the key is honoured, and
   * `config:check --strict` rejects it anyway.
   *
   * Declaring it here is additive: package schemas are merged with
   * `ignoreAdditionalProperties`, so this fills the hole without shadowing the
   * module's own declarations. Delete it once the module declares `schedule`.
   */
  catalog?: {
    providers?: {
      ldapOrg?: {
        [id: string]: {
          /** How often the LDAP directory is re-read. */
          schedule?: {
            frequency?:
              | string
              | { hours?: number; minutes?: number; seconds?: number };
            timeout?:
              | string
              | { hours?: number; minutes?: number; seconds?: number };
            initialDelay?:
              | string
              | { hours?: number; minutes?: number; seconds?: number };
            scope?: 'global' | 'local';
          };
        };
      };
    };
  };
  platform?: {
    /**
     * Argo Workflows connection. Backend-only — the browser never talks to
     * argo-server directly, it goes through this plugin's router.
     *
     * Declared so a typo is a startup error rather than a silent outage:
     * `plugin.ts` falls back to `http://localhost:2746`, so a production
     * `baseurl` (lower-case `u`) would otherwise validate fine, fall back to
     * localhost, and fail every submit against a host that is not there.
     */
    argo?: {
      /**
       * argo-server base URL, used when `proxyPath` is unset.
       * @default http://localhost:2746
       */
      baseUrl?: string;
      /**
       * Namespace workflows are submitted into. Must match
       * `platform.secrets.namespace` — a Secret's ownerReference is namespaced.
       * @default argo
       */
      namespace?: string;
      /**
       * WorkflowTemplate used when a request's `argoSubmit` names none.
       * @default demo-resource
       */
      defaultTemplate?: string;
      /**
       * A `proxy.endpoints` path to route Argo calls through, so the
       * argo-server credential is injected server-side and never reaches this
       * plugin's config. Unset = talk to `baseUrl` directly (dev only).
       */
      proxyPath?: string;
    };
    /**
     * Per-request Kubernetes Secret provisioning: when a request carries secret
     * fields (a DB password, an API key, …) the backend materialises them as a
     * Kubernetes Secret at approval time, owned by the Argo Workflow, so the
     * value never appears in the request row, Argo params/UI, Git, or logs.
     * See TechDocs: Explanation -> Secret lifecycle.
     */
    /** Request retention. Off by default — deleting rows is irreversible. */
    requests?: {
      retention?: {
        /** @default false */
        enabled?: boolean;
        /** Log what would be expired and deleted, change nothing. @default false */
        dryRun?: boolean;
        /** Rows deleted per state per run. @default 500 */
        batchSize?: number;
        /**
         * Days a PENDING_APPROVAL waits before becoming EXPIRED. 0 disables.
         * @default 14
         */
        pendingExpiryDays?: number;
        /** @default 90 */
        succeededDays?: number;
        /** @default 90 */
        failedDays?: number;
        /** @default 30 */
        rejectedDays?: number;
        /** @default 30 */
        expiredDays?: number;
        frequency?: { hours?: number; minutes?: number; seconds?: number };
      };
    };

    secrets?: {
      /**
       * Enable secret provisioning. When false a request that requires a secret
       * fails fast rather than storing it insecurely.
       * @default false
       */
      enabled?: boolean;

      /**
       * Namespace the per-request Secrets are created in. MUST be the namespace
       * the Argo Workflows run in — ownerReferences are namespace-scoped, so the
       * Secret and its owning Workflow have to co-locate.
       * @default argo
       */
      namespace?: string;

      /**
       * Envelope-encryption key for user-*provided* secrets held (encrypted)
       * between submit and approval. Not needed for generated secrets.
       *
       * A list rotates the key without re-encrypting: the first entry encrypts,
       * every entry is tried on decrypt. Prepend the new key, and drop the old
       * one once no pending request still holds a blob from its era.
       * @visibility secret
       */
      encryptionKey?: string | string[];

      /**
       * Safety-net garbage collector for orphaned/expired request Secrets
       * (the happy path is handled by the Workflow ownerReference).
       */
      sweep?: {
        /**
         * Run the sweep on a schedule.
         * @default true
         */
        enabled?: boolean;

        /**
         * How often the sweep runs.
         * @default { minutes: 15 }
         */
        frequency?: {
          hours?: number;
          minutes?: number;
          seconds?: number;
        };

        /**
         * Hard cap: delete any request Secret older than this many hours even if
         * it is otherwise unaccounted for.
         * @default 24
         */
        maxAgeHours?: number;
      };
    };
  };
}
