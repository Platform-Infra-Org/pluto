export interface Config {
  platform?: {
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
