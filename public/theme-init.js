/*
 * Runs before first paint (plain <script>, not deferred) to set the color
 * scheme from the saved preference or the OS setting, preventing a flash of
 * the wrong theme. Mirrors AppThemeProvider's resolution order exactly.
 */
(function () {
  try {
    var d = document.documentElement;
    var k = 'portfolio.theme';
    var p = null;
    try {
      var r = localStorage.getItem(k);
      if (r) {
        p = JSON.parse(r).theme;
      }
    } catch (e) {}
    var t;
    if (p === 'dark' || p === 'light') {
      t = p;
      d.style.colorScheme = p;
    } else {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      d.style.colorScheme = 'dark light';
    }
    d.setAttribute('data-theme', t);
  } catch (e) {
    /* Private-mode localStorage throws; default stylesheet handles it. */
  }
})();
