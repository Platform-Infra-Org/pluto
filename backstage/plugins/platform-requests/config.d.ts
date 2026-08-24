export interface Config {
  platform?: {
    /** Where this deployment's catalog entities live. */
    catalog?: {
      /**
       * Namespace holding the Resource and User entities the platform links to
       * and notifies. Applies to resource refs, user refs and catalog routes
       * alike — users and resources are assumed to share one namespace.
       *
       * `platform.rbac.*` is unaffected: those entityRefs carry their own
       * namespace inline (`group:default/platform-admins`).
       *
       * Frontend-visible on purpose. Half the call sites are in the browser,
       * and a key without this annotation is stripped out of frontend config,
       * leaving the UI silently on `default` while the backend uses the
       * configured value — links and notifications would then disagree.
       * @visibility frontend
       * @default default
       */
      namespace?: string;
    };
    argo?: {
      /**
       * Base URL of the Argo Workflows **UI**, as a browser can reach it, used
       * to turn a request's workflow name into a link.
       *
       * Deliberately separate from `platform.argo.baseUrl` (declared by
       * `backstage-plugin-platform-requests-backend`) rather than a
       * frontend-visible re-use of it. That one is the address the *backend*
       * dials argo-server on: in-cluster in production, and unset entirely when
       * `proxyPath` is configured. Neither is a URL a browser can follow, so
       * pointing links at it would produce a page that never loads.
       *
       * Unset means the workflow name renders as plain text, exactly as it did
       * before this key existed — no broken link, and nothing to configure for
       * a deployment that does not expose the Argo UI.
       * @visibility frontend
       */
      uiUrl?: string;
    };
    /** Home / landing page configuration. */
    home?: {
      /**
       * Heading shown at the top of the home page.
       * @visibility frontend
       */
      title?: string;
      /**
       * Sub-heading under the title.
       * @visibility frontend
       */
      subtitle?: string;
      /**
       * Which sections to show, in order. Defaults to all.
       * @visibility frontend
       */
      sections?: (
        | 'quickActions'
        | 'ownedResources'
        | 'standingRequests'
        | 'pendingApprovals'
        | 'recentlyVisited'
        | 'favouriteTemplates'
        | 'pantheon'
      )[];
      /**
       * Max rows shown per section (0 = no limit). Default 8.
       * @visibility frontend
       */
      maxItems?: number;
    };
    /** Which groups are treated as platform admins / auditors. */
    rbac?: {
      /**
       * Group entityRefs whose members are platform admins (approve anything,
       * see all requests). Default: [group:default/platform-admins].
       * @visibility frontend
       */
      adminGroups?: string[];
      /**
       * Group entityRefs whose members are read-only auditors.
       * Default: [group:default/platform-auditors].
       * @visibility frontend
       */
      auditorGroups?: string[];
    };
  };
}
