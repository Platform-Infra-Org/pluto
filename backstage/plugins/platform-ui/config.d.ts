export interface Config {
  app?: {
    /**
     * Branding for the platform mark (sidebar + sign-in tile) and the browser
     * tab icon. Both are optional; without them the built-in temple glyph and
     * the static favicons in `packages/app/public` are used.
     *
     * See TechDocs → How-to → *Change the logo, favicon and title*.
     */
    branding?: {
      /**
       * URL of the logo drawn inside the accent-coloured tile, e.g.
       * `/branding/mark.svg` for a file in `packages/app/public/branding/`.
       *
       * Transparent areas show the tile, which follows the colour picker, so a
       * light monochrome logo with transparency reads well against every
       * scheme. Same-origin only (the CSP is `img-src 'self' data:`).
       * @visibility frontend
       */
      mark?: string;

      /**
       * Browser tab icon. Omit it and the tab icon is generated from the glyph
       * — `mark` if set, the built-in one otherwise — drawn over the picked
       * accent colour, so it recolours with the theme. Set it to pin a fixed
       * icon instead.
       * @visibility frontend
       */
      favicon?: string;

      /**
       * Software-template card headers, supplied as images.
       *
       * Drop files into `packages/app/src/branding/<dir>/` and they are used in
       * filename order, cycling across the cards. With no images, the built-in
       * pixel art is used instead.
       */
      templateHeaders?: {
        /**
         * Explicit header image URLs, overriding `dir`.
         *
         * `dir` is resolved by the bundler at build time, so a volume mount can
         * never contribute to it — the bundler never saw the files and the URLs
         * are content-hashed into main.js. This key is read at runtime instead:
         * mount images under `packages/app/dist/branding/…`, which app-backend
         * already serves, and name them here to change the art without a
         * rebuild.
         *
         * Same-origin paths only (the CSP is `img-src 'self' data:`); anything
         * cross-origin is ignored rather than rendering as a blank header. An
         * empty list falls back to `dir`.
         * @visibility frontend
         */
        images?: string[];
        /**
         * Subfolder of `packages/app/src/branding/` to read.
         * @default template-headers
         * @visibility frontend
         */
        dir?: string;
        /**
         * Header height, any CSS length.
         * @default 90px
         * @visibility frontend
         */
        height?: string;
        /**
         * How the crop is anchored, any CSS background-position.
         * @default center
         * @visibility frontend
         */
        position?: string;
      };

      /**
       * Optional naming flavour for the sidebar.
       *
       * `fantasy` renames **screens only** — Requests → Quests, Create →
       * Summon, Catalog → Atlas. Request states are records and are never
       * renamed: a screen someone cannot find is one click away, but
       * `QUEST FAILED` in an audit trail is a support ticket.
       *
       * Omit for the literal names.
       * @visibility frontend
       */
      flavour?: 'fantasy';
    };
  };

  platform?: {
    /**
     * An existing Grafana dashboard, embedded. Frontend-visible, so it holds a
     * URL and nothing else — this feature makes no Grafana API call and needs
     * no token. baseUrl is also the origin allowlist: nothing outside it is
     * ever framed.
     * @visibility frontend
     */
    grafana?: {
      /** @visibility frontend */
      baseUrl: string;
      /** @visibility frontend */
      dashboard: {
        /** @visibility frontend */
        uid: string;
        /** @visibility frontend */
        slug: string;
      };
      /** @visibility frontend */
      theme?: 'light' | 'dark';
      /** @visibility frontend */
      kiosk?: boolean;
    };
  };
}
