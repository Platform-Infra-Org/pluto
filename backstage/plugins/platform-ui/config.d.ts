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
    };
  };
}
