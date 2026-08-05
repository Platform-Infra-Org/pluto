# Template header images

Drop image files in here and they become the software-template card headers,
in filename order. Nothing else to do — no config, no script.

- Formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`
- Recommended size: **752×180** (the header renders at 376×90; double for retina)
- Anything larger is cropped to fill, not squashed
- Remove an image by deleting the file; reorder by renaming

To use a different folder, create a sibling of this one and point config at it:

    app:
      branding:
        templateHeaders:
          dir: my-other-folder
