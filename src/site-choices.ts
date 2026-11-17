/**
 * Choices that are a matter of taste, each as ONE switch.
 *
 * The 2026-11 redesign made a few decisions the site's owner may want to take
 * back without undoing the rest. Each of those is a word in this file: change
 * it, run `npm run verify`, and push. REDESIGN.md says what each one looks
 * like either way, and how to undo the things that are not switches (wording,
 * or the whole redesign).
 *
 * A switch is only worth having while the choice is open. Once one is
 * settled, delete it and the path it turns off.
 */
export interface SiteChoices {
  /**
   * Show a post's headline number: the "Recently measured" block on the home
   * page, the chip beside a post in the lists, and the figure in the margin of
   * the post itself. Off: none of them appear (the numbers stay in the posts'
   * frontmatter, unused).
   */
  headlineNumbers: boolean;
  /**
   * On phones, a row of the Videos page shows a small cover beside its title.
   * Off: the cover is as wide as the screen, as it was before. (That makes a
   * picture the largest thing on a phone's first screen; measured with
   * Lighthouse on mobile, the page's performance score was 96 that way and is
   * 100 this way.)
   */
  smallVideoCoversOnPhones: boolean;
}

export const CHOICES: SiteChoices = {
  headlineNumbers: true,
  smallVideoCoversOnPhones: true,
};
