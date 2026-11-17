# The 2026-11 redesign: what can be undone, and how

The redesign changed the look, the wording of a few pages and how two things
are laid out. Each part that is a matter of taste can be taken back by itself:
a switch, a line of text, or one command for all of it.

After any change below: `npm run verify`, commit, push to `main` (that deploys).

## Switches

One word each, in `src/site-choices.ts`. Change `true` to `false`.

| Switch | On (now) | Off |
| --- | --- | --- |
| `headlineNumbers` | A post can show its headline number: the "Recently measured" block on the home page, the chip beside the post in lists, the figure in the post's margin. | None of them appear. The numbers stay in the posts' frontmatter, unused. |
| `smallVideoCoversOnPhones` | On a phone, a row of the Videos page has a small cover beside its title. | The cover is as wide as the screen, as before. Measured with Lighthouse on mobile, the Videos page scored 96 for performance that way and scores 100 with the small cover. |

To take the number off ONE post, delete its `keyMetric:` line in
`content/posts/<post>.md` and run `npm run content:build`.

## Wording

The redesign rewrote these. To go back, paste the old text over the new.

| Page | File | Before | Now |
| --- | --- | --- | --- |
| Home, under the name | `src/pages/Home.tsx` | "I turn analytical work into software that survives production — and production realities back into the analysis." | "AI engineer and technical consultant. I run open-weight models on a six-machine GPU lab, build the tools that operate it, and publish what I measure." |
| Home, second paragraph | `src/pages/Home.tsx` | "I help teams turn data-science results into services that survive production. That means making "it runs on my machine" become "it runs, and we know why."" | "My background is full-stack engineering and data science. I help teams turn data-science results into services that survive production." |
| About, heading | `src/pages/About.tsx` | "Consultant by title, engineer by habit." | "I'm a technical consultant who still writes the code I recommend." |
| About, first line | `src/pages/About.tsx` | "I am William Boyden — a technical consultant who came through full-stack web engineering and a data-science degree, and who still writes the code he recommends." | "I am William Boyden. I came to consulting through full-stack web engineering and a data-science degree." |
| Contact, heading | `src/pages/Contact.tsx` | "Tell me what is actually broken." | "Tell me what is broken." |
| Contact, first paragraph (ending) | `src/pages/Contact.tsx` | "I read everything myself, and a concrete "no" or a referral is a real answer — you will never be left in silence." | "I read everything myself and I always reply, even when the answer is a no or a referral." |
| Contact, two closing lines | `src/pages/Contact.tsx` | "Silence is the failure mode I promise to avoid." and "Dependency is a defect, not a business model." | removed |
| Not found, heading | `src/pages/NotFound.tsx` | "This page doesn't exist — yet." | "This page doesn't exist." |
| Now, first heading | `src/pages/Now.tsx` | "Local AI a team can actually operate" | "Local AI a team can operate" |

Smaller edits on those pages (a dash turned into a full stop or brackets) are
in the same files. The exact old page is always one command away:

```bash
git show before-redesign-2026-11:src/pages/About.tsx
```

## A theme

Remove its id from `ThemeName`, its entry from `THEME_INFO` and its recipe from
`RECIPES` in `src/theme/tokens.ts`, then `npm run themes:sync`. A visitor who
had picked it falls back to their device's light or dark setting.

## All of it

The tag `before-redesign-2026-11` is the site as it was. This puts every file
back and keeps the history:

```bash
git revert --no-commit before-redesign-2026-11..main
git commit -m "Revert the 2026-11 redesign"
```

That takes back everything since the tag, not only the look: the three videos
added with it, the share images (the old ones carried a placeholder name), and
the faster start. The design, the themes and the typeface depend on each other
and come out together; to keep the videos or the share images, add them back
from the commits named "Videos: ..." and "Share images and icons: ...".
