/*
 * Runs before first paint (plain <script>, not deferred) to set the theme
 * from the saved preference or the OS setting, preventing a flash of the
 * wrong theme. Mirrors AppThemeProvider's resolution order exactly.
 *
 * Two tables, each on ONE line (the formatter is told to leave them), written
 * by scripts/sync-theme-init.mjs from src/theme/tokens.ts; the theme tests
 * fail when they differ from it:
 *
 * MODES is every theme id and whether its page is light or dark. A stored id
 * that is not in the table is ignored, so a retired theme falls back to the
 * device setting instead of an unstyled attribute.
 *
 * VARS is the colours of every theme the page's stylesheet does not hold.
 * The stylesheet has Night (on :root) and Paper ([data-theme=light]); any
 * other theme is applied here as custom properties on <html>, so its colours
 * are in place for the first frame. The app does the same when a theme is
 * picked (tokens.ts: applyThemeVars).
 */
(function () {
  try {
    var d = document.documentElement;
    var k = 'portfolio.theme';
    // prettier-ignore
    var MODES = {"light":"light","legal":"light","ledger":"light","manila":"light","graph":"light","newsprint":"light","dark":"dark","blueprint":"dark","chalkboard":"dark","phosphor":"dark","graphite":"dark","darkroom":"dark"};
    // prettier-ignore
    var VARS = {"legal":{"--c-bg":"#faf5d2","--c-bg-elevated":"#fdfcef","--c-bg-sunken":"#f0eccb","--c-surface":"#fdfcef","--c-surface-hover":"#f4f0ce","--c-border":"#dddabf","--c-border-strong":"#878a87","--c-rule":"#1a2440","--c-text":"#1a2440","--c-text-muted":"#4c5260","--c-text-subtle":"#646970","--c-accent":"#1a2440","--c-accent-text":"#ffffff","--c-accent-soft":"rgba(255, 141, 122, 0.3)","--c-accent-border":"#e88374","--c-mark":"#ff8d7a","--c-mark-ink":"#16161a","--c-success":"#0b6b47","--c-warning":"#8a5a00","--c-danger":"#b3261e","--c-series1":"#2a78d6","--c-series2":"#eb6834","--c-series3":"#1baf7a","--c-focus":"#1a2440","--c-scrim":"rgba(26, 36, 64, 0.5)","--c-skeleton":"rgba(26, 36, 64, 0.06)","--sh-sm":"none","--sh-md":"0 1px 2px rgba(26, 36, 64, 0.06), 0 8px 24px rgba(26, 36, 64, 0.1)","--sh-lg":"0 24px 64px rgba(26, 36, 64, 0.18)","--sh-glow":"0 0 0 2px #ff8d7a"},"ledger":{"--c-bg":"#edf3e6","--c-bg-elevated":"#f9fbf6","--c-bg-sunken":"#e3eadd","--c-surface":"#f9fbf6","--c-surface-hover":"#e8eee1","--c-border":"#d1d8cc","--c-border-strong":"#828b81","--c-rule":"#16241c","--c-text":"#16241c","--c-text-muted":"#48544a","--c-text-subtle":"#5e6a60","--c-accent":"#16241c","--c-accent-text":"#ffffff","--c-accent-soft":"rgba(255, 179, 71, 0.3)","--c-accent-border":"#e8a543","--c-mark":"#ffb347","--c-mark-ink":"#16161a","--c-success":"#0b6b47","--c-warning":"#8a5a00","--c-danger":"#b3261e","--c-series1":"#2a78d6","--c-series2":"#eb6834","--c-series3":"#1baf7a","--c-focus":"#16241c","--c-scrim":"rgba(22, 36, 28, 0.5)","--c-skeleton":"rgba(22, 36, 28, 0.06)","--sh-sm":"none","--sh-md":"0 1px 2px rgba(22, 36, 28, 0.06), 0 8px 24px rgba(22, 36, 28, 0.1)","--sh-lg":"0 24px 64px rgba(22, 36, 28, 0.18)","--sh-glow":"0 0 0 2px #ffb347"},"manila":{"--c-bg":"#f3ead3","--c-bg-elevated":"#fbf8f0","--c-bg-sunken":"#eae1ca","--c-surface":"#fbf8f0","--c-surface-hover":"#eee5ce","--c-border":"#d9d0ba","--c-border-strong":"#8f8473","--c-rule":"#2b1f14","--c-text":"#2b1f14","--c-text-muted":"#564b3d","--c-text-subtle":"#6d6152","--c-accent":"#2b1f14","--c-accent-text":"#ffffff","--c-accent-soft":"rgba(255, 154, 118, 0.3)","--c-accent-border":"#ea8e6c","--c-mark":"#ff9a76","--c-mark-ink":"#16161a","--c-success":"#0b6b47","--c-warning":"#885900","--c-danger":"#b3261e","--c-series1":"#2a78d6","--c-series2":"#eb6834","--c-series3":"#1baf7a","--c-focus":"#2b1f14","--c-scrim":"rgba(43, 31, 20, 0.5)","--c-skeleton":"rgba(43, 31, 20, 0.06)","--sh-sm":"none","--sh-md":"0 1px 2px rgba(43, 31, 20, 0.06), 0 8px 24px rgba(43, 31, 20, 0.1)","--sh-lg":"0 24px 64px rgba(43, 31, 20, 0.18)","--sh-glow":"0 0 0 2px #ff9a76"},"graph":{"--c-bg":"#f4f7fb","--c-bg-elevated":"#fbfcfe","--c-bg-sunken":"#eaedf2","--c-surface":"#fbfcfe","--c-surface-hover":"#eef2f6","--c-border":"#d7dbe2","--c-border-strong":"#868e9d","--c-rule":"#13203b","--c-text":"#13203b","--c-text-muted":"#495469","--c-text-subtle":"#606a7d","--c-accent":"#13203b","--c-accent-text":"#ffffff","--c-accent-soft":"rgba(155, 229, 100, 0.3)","--c-accent-border":"#8dd160","--c-mark":"#9be564","--c-mark-ink":"#16161a","--c-success":"#0b6b47","--c-warning":"#8a5a00","--c-danger":"#b3261e","--c-series1":"#2a78d6","--c-series2":"#eb6834","--c-series3":"#1baf7a","--c-focus":"#13203b","--c-scrim":"rgba(19, 32, 59, 0.5)","--c-skeleton":"rgba(19, 32, 59, 0.06)","--sh-sm":"none","--sh-md":"0 1px 2px rgba(19, 32, 59, 0.06), 0 8px 24px rgba(19, 32, 59, 0.1)","--sh-lg":"0 24px 64px rgba(19, 32, 59, 0.18)","--sh-glow":"0 0 0 2px #9be564"},"newsprint":{"--c-bg":"#e9e7e0","--c-bg-elevated":"#f7f7f4","--c-bg-sunken":"#dfded7","--c-surface":"#f7f7f4","--c-surface-hover":"#e4e2db","--c-border":"#cdccc5","--c-border-strong":"#84837e","--c-rule":"#141413","--c-text":"#141413","--c-text-muted":"#474744","--c-text-subtle":"#61605d","--c-accent":"#141413","--c-accent-text":"#ffffff","--c-accent-soft":"rgba(255, 155, 203, 0.3)","--c-accent-border":"#e88eb9","--c-mark":"#ff9bcb","--c-mark-ink":"#16161a","--c-success":"#0b6b47","--c-warning":"#855701","--c-danger":"#b3261e","--c-series1":"#2a78d6","--c-series2":"#eb6834","--c-series3":"#1baf7a","--c-focus":"#141413","--c-scrim":"rgba(20, 20, 19, 0.5)","--c-skeleton":"rgba(20, 20, 19, 0.06)","--sh-sm":"none","--sh-md":"0 1px 2px rgba(20, 20, 19, 0.06), 0 8px 24px rgba(20, 20, 19, 0.1)","--sh-lg":"0 24px 64px rgba(20, 20, 19, 0.18)","--sh-glow":"0 0 0 2px #ff9bcb"},"blueprint":{"--c-bg":"#0f2542","--c-bg-elevated":"#162c48","--c-bg-sunken":"#0a182b","--c-surface":"#162c48","--c-surface-hover":"#1e334f","--c-border":"#293d58","--c-border-strong":"#68788f","--c-rule":"#e4eefa","--c-text":"#e4eefa","--c-text-muted":"#acb9ca","--c-text-subtle":"#8696a9","--c-accent":"#e4eefa","--c-accent-text":"#16161a","--c-accent-soft":"rgba(255, 209, 102, 0.18)","--c-accent-border":"#ffd166","--c-mark":"#ffd166","--c-mark-ink":"#16161a","--c-success":"#5bd6a0","--c-warning":"#f0b860","--c-danger":"#ff8a80","--c-series1":"#3987e5","--c-series2":"#d95926","--c-series3":"#199e70","--c-focus":"#ffd166","--c-scrim":"rgba(6, 15, 26, 0.74)","--c-skeleton":"rgba(228, 238, 250, 0.07)","--sh-sm":"none","--sh-md":"0 8px 24px rgba(0, 0, 0, 0.5)","--sh-lg":"0 24px 64px rgba(0, 0, 0, 0.6)","--sh-glow":"0 0 0 2px #ffd166"},"chalkboard":{"--c-bg":"#1c2925","--c-bg-elevated":"#23302c","--c-bg-sunken":"#121b18","--c-surface":"#23302c","--c-surface-hover":"#2b3733","--c-border":"#35413c","--c-border-strong":"#717974","--c-rule":"#eef1e8","--c-text":"#eef1e8","--c-text-muted":"#b5bbb4","--c-text-subtle":"#929992","--c-accent":"#eef1e8","--c-accent-text":"#16161a","--c-accent-soft":"rgba(255, 179, 200, 0.18)","--c-accent-border":"#ffb3c8","--c-mark":"#ffb3c8","--c-mark-ink":"#16161a","--c-success":"#5bd6a0","--c-warning":"#f0b860","--c-danger":"#ff8a80","--c-series1":"#3987e5","--c-series2":"#d95926","--c-series3":"#199e70","--c-focus":"#ffb3c8","--c-scrim":"rgba(11, 16, 15, 0.74)","--c-skeleton":"rgba(238, 241, 232, 0.07)","--sh-sm":"none","--sh-md":"0 8px 24px rgba(0, 0, 0, 0.5)","--sh-lg":"0 24px 64px rgba(0, 0, 0, 0.6)","--sh-glow":"0 0 0 2px #ffb3c8"},"phosphor":{"--c-bg":"#0b100c","--c-bg-elevated":"#121813","--c-bg-sunken":"#070a08","--c-surface":"#121813","--c-surface-hover":"#18201a","--c-border":"#222b23","--c-border-strong":"#576c59","--c-rule":"#c9f4cd","--c-text":"#c9f4cd","--c-text-muted":"#90b093","--c-text-subtle":"#748d76","--c-accent":"#c9f4cd","--c-accent-text":"#16161a","--c-accent-soft":"rgba(255, 176, 0, 0.18)","--c-accent-border":"#ffb000","--c-mark":"#ffb000","--c-mark-ink":"#16161a","--c-success":"#5bd6a0","--c-warning":"#f0b860","--c-danger":"#ff8a80","--c-series1":"#3987e5","--c-series2":"#d95926","--c-series3":"#199e70","--c-focus":"#ffb000","--c-scrim":"rgba(4, 6, 5, 0.74)","--c-skeleton":"rgba(201, 244, 205, 0.07)","--sh-sm":"none","--sh-md":"0 8px 24px rgba(0, 0, 0, 0.5)","--sh-lg":"0 24px 64px rgba(0, 0, 0, 0.6)","--sh-glow":"0 0 0 2px #ffb000"},"graphite":{"--c-bg":"#1b1d21","--c-bg-elevated":"#222428","--c-bg-sunken":"#121315","--c-surface":"#222428","--c-surface-hover":"#292b30","--c-border":"#34363a","--c-border-strong":"#6e7074","--c-rule":"#e9ecf1","--c-text":"#e9ecf1","--c-text-muted":"#acafb4","--c-text-subtle":"#8c8f93","--c-accent":"#e9ecf1","--c-accent-text":"#16161a","--c-accent-soft":"rgba(95, 212, 230, 0.18)","--c-accent-border":"#5fd4e6","--c-mark":"#5fd4e6","--c-mark-ink":"#16161a","--c-success":"#5bd6a0","--c-warning":"#f0b860","--c-danger":"#ff8a80","--c-series1":"#3987e5","--c-series2":"#d95926","--c-series3":"#199e70","--c-focus":"#5fd4e6","--c-scrim":"rgba(11, 12, 13, 0.74)","--c-skeleton":"rgba(233, 236, 241, 0.07)","--sh-sm":"none","--sh-md":"0 8px 24px rgba(0, 0, 0, 0.5)","--sh-lg":"0 24px 64px rgba(0, 0, 0, 0.6)","--sh-glow":"0 0 0 2px #5fd4e6"},"darkroom":{"--c-bg":"#170c0c","--c-bg-elevated":"#1f1413","--c-bg-sunken":"#0f0808","--c-surface":"#1f1413","--c-surface-hover":"#261b1b","--c-border":"#322625","--c-border-strong":"#706261","--c-rule":"#f4e4df","--c-text":"#f4e4df","--c-text-muted":"#b2a3a0","--c-text-subtle":"#918380","--c-accent":"#f4e4df","--c-accent-text":"#16161a","--c-accent-soft":"rgba(255, 94, 82, 0.18)","--c-accent-border":"#ff5e52","--c-mark":"#ff5e52","--c-mark-ink":"#16161a","--c-success":"#5bd6a0","--c-warning":"#f0b860","--c-danger":"#ff8a80","--c-series1":"#3987e5","--c-series2":"#d95926","--c-series3":"#199e70","--c-focus":"#ff5e52","--c-scrim":"rgba(9, 5, 5, 0.74)","--c-skeleton":"rgba(244, 228, 223, 0.07)","--sh-sm":"none","--sh-md":"0 8px 24px rgba(0, 0, 0, 0.5)","--sh-lg":"0 24px 64px rgba(0, 0, 0, 0.6)","--sh-glow":"0 0 0 2px #ff5e52"}};
    var p = null;
    try {
      var r = localStorage.getItem(k);
      if (r) {
        /* Current format: {"theme":"light"}. Tolerate the legacy bare string
         * ("light") exactly like ThemePreference does at hydration — if this
         * script fell to system while the app then read the stored value, the
         * pre-paint palette would flash wrong on legacy prefs. */
        if (r === 'dark' || r === 'light') {
          p = r;
        } else {
          p = JSON.parse(r).theme;
        }
      }
    } catch (e) {}
    var t;
    if (typeof p === 'string' && Object.prototype.hasOwnProperty.call(MODES, p)) {
      t = p;
      d.style.colorScheme = MODES[p];
    } else {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      d.style.colorScheme = 'dark light';
    }
    d.setAttribute('data-theme', t);
    if (Object.prototype.hasOwnProperty.call(VARS, t)) {
      var s = VARS[t];
      for (var n in s) {
        if (Object.prototype.hasOwnProperty.call(s, n)) d.style.setProperty(n, s[n]);
      }
    }
  } catch (e) {
    /* Private-mode localStorage throws; default stylesheet handles it. */
  }
})();
