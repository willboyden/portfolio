# Third-party notices

This repository bundles reduced, API-compatible subsets of the following
MIT-licensed projects under `vendor/` (kept in-tree so the site builds with no
network access; contract tests pin their behavior — see
`vendor/emotion/emotion.contract.test.tsx` and the test suite). Their MIT
license texts apply to the portions derived from or modeled on those projects.

## React / ReactDOM

- Upstream: https://github.com/facebook/react
- License: MIT — Copyright (c) Meta Platforms, Inc. and affiliates.
- Used as: runtime dependencies (`react`, `react-dom`), installed from the
  npm registry at build time (not vendored in-tree).

## Emotion (@emotion/react, @emotion/styled)

- Upstream: https://github.com/emotion-js/emotion
- License: MIT — Copyright (c) Emotion team and other contributors.
- Used as: `vendor/emotion/{core,react,styled}` — a reduced in-tree subset
  implementing the subset of the public API this site uses (the `css` prop
  via the JSX runtime, `styled`, theme context, serialization), with the same
  package names aliased in `vite.config.ts` so a future swap to the published
  packages is a delete-and-`npm install`.

## Zod

- Upstream: https://github.com/colinhacks/zod
- License: MIT — Copyright (c) 2020 Colin McDonnell.
- Used as: content-frontmatter schema validation (`src/content/schema.ts`),
  installed from the npm registry at build time.

## IBM Plex (Sans, Serif, Mono)

- Upstream: https://github.com/IBM/plex
- License: SIL Open Font License 1.1 — Copyright © 2017 IBM Corp., with
  Reserved Font Name "Plex". The licence text ships with the fonts at
  `public/fonts/LICENSE.txt`.
- Used as: the site's typefaces, served from `public/fonts/`. The files are
  IBM's own WOFF2 "split" files, **unmodified** (not subset, renamed or
  re-encoded here, as the Reserved Font Name requires), taken from these
  release archives:

  | Release | Archive | SHA-256 |
  | --- | --- | --- |
  | `@ibm/plex-sans@1.1.0` | `ibm-plex-sans.zip` | `fb365d910566e6d199cc2c15579a7dd9a267128e18431a394ed81f1970c69200` |
  | `@ibm/plex-serif@2.0.0` | `ibm-plex-serif.zip` | `c006b095c47b919c6c8d78319e9e628745033f5db94507c1c9dfe4b35dd51f1e` |
  | `@ibm/plex-mono@2.5.0` | `ibm-plex-mono.zip` | `6d23f01257663d8cc49a0d64c22ced630b79e0e2a0ac08a0da86e9a38bbc481c` |

  Each shipped file's own SHA-256 is pinned in `src/theme/fonts.ts` and checked
  by `src/theme/fonts.test.ts`.

All other source in this repository is original work licensed under the MIT
license in `LICENSE`. Generated assets under `public/og/` are produced by
`scripts/gen_media.py` from this repository's own identity constants.
