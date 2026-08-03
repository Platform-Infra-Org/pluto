export interface Config {
  platform?: {
    /**
     * Per-request Kubernetes Secret provisioning: when a request carries secret
     * fields (a DB password, an API key, …) the backend materialises them as a
     * Kubernetes Secret at approval time, owned by the Argo Workflow, so the
     * value never appears in the request row, Argo params/UI, Git, or logs.
     * See docs/SECRETS-LIFECYCLE.md.
     */
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
