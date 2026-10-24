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

All other source in this repository is original work licensed under the MIT
license in `LICENSE`. Generated assets under `public/og/` are produced by
`scripts/gen_media.py` from this repository's own identity constants.
