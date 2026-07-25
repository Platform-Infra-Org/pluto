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
  };
}
