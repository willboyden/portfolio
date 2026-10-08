# ui/ — reusable primitives

The complete styling vocabulary for the portfolio. Page builders import
**only** from `app/components/ui`; nothing here reaches into pages or layout.

## Rules this library upholds

- **Emotion only.** Every style is `@emotion/styled` or `css()` + className.
  No CSS files, no inline `style` props.
- **Tokens only.** Every colour/spacing/radius/font value comes from
  `p.theme` (`src/theme/tokens.ts`). Both themes are tested.
- **Transient props.** Styling-only props are `$`-prefixed so they never hit
  the DOM (verified by tests asserting the rendered HTML).
- **Accessibility.** Interactive elements are keyboard reachable with a
  `:focus-visible` ring in `theme.color.focus`, hit areas are >= 44×44 px, and
  `prefers-reduced-motion` disables every transition/animation.
- **Contrast.** All text pairs measured; primary button text is
  `color.bg` on `color.accent` (6.11:1 dark / 5.16:1 light) — not
  `accentText/#fff`, which fails at 3.16:1 on the dark accent. Full table in
  `FINDINGS.md`.

## Components

| Export | Renders | Key props |
| --- | --- | --- |
| `Button` | `button`/`a`/component | `variant` primary·secondary·ghost·danger, `size` sm·md·lg, `as`, `href`, `iconLeft/Right`, `loading` |
| `Tag` | `span` | `$tone`-backed `tone` default·accent·outline, `size` |
| `Card` | `article` (or `a` via `href`, or `as`) | `interactive`, `href`, `pad` |
| `Section` | `section` landmark | `id`, `size`, `eyebrow`, `title`, `description` (title → h2 wired via `aria-labelledby`) |
| `Container` | `div` | `size` default·narrow·prose·wide |
| `Stack` | `div`/`ul`/`ol`/`span` | `gap` (space-scale keys), `direction`, `wrap`, `align`, `justify` |
| `Prose` | `div[data-prose]` | styles generated markdown at a 68ch `--measure` |
| `Heading` | `h1..h4` | `level` (semantics), `size` (visual override) |
| `Spinner` | `span[role=status]` | `size`, `label`; pulses instead of spinning under reduced motion |
| `EmptyState` | `div[role=status]` | `icon`, `title`, `description`, `action` (real focusable children) |
| `SkipLink` | `a` → `#main` | off-screen until focused |
| `VisuallyHidden` | `span` | canonical clip-rect hiding |
| `Pagination` | `nav > ul` | `page`, `total`, `hrefFor`; `aria-current="page"`, disabled edges |
| `Icon` | inline `svg` | `name` (19 glyphs), `size`, `label?` → `role=img` vs `aria-hidden` |

## Polymorphism caveat (vendored Emotion)

`styled()` prop-filters **component** targets, which would strip the router
`Link`'s required `to` prop. `Button` therefore renders component targets
directly with a `css()` class generated from the *same* style builder the
styled component uses — identical rule text, identical class hash, verified by
tests comparing the two paths.

## Browser-test hooks

Every component emits a default `data-testid`. Button also emits
`data-variant`, `data-size`, `data-loading` and `aria-busy` while loading.
Pagination emits `data-page` / `data-edge="prev|next"`. Icon emits
`data-icon="<name>"`.
