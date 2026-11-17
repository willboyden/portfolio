/**
 * The entry script: let the browser show the page first, then start the app.
 *
 * Every page arrives as finished HTML, so the visitor is looking at it before
 * a line of this runs. Starting the app at once would spend that moment
 * running a few hundred kilobytes of script: on a fast connection or a repeat
 * visit the scripts are ready before the first frame is, and the frame waits
 * for them. So this file does nothing but wait until the first screen is on
 * screen, then import the app (src/app/start.tsx):
 *
 *   1. the browser has REPORTED painting content (its paint timing entry, not
 *      merely a frame having been requested);
 *   2. the pictures that load with the page and sit on the first screen have
 *      loaded and been painted too (usually there are none).
 *
 * The app's files are fetched in parallel from the first byte (the page
 * preloads them); only RUNNING them waits. Every wait has a limit, so a slow
 * picture or an unusual browser delays the app by a moment, never for good.
 */
const html = document.documentElement;

/* For tools: the app is on its way. src/app/start.tsx replaces this with how
 * it took the page over; the browser suite waits on the pair. */
html.setAttribute('data-boot', 'pending');

/** Longest the app waits for the first paint to be reported. */
const PAINT_LIMIT_MS = 1500;
/** Longest it then waits for the first screen's pictures. */
const PICTURE_LIMIT_MS = 2500;
/** Longest it waits for a loaded picture to be reported as painted. */
const PICTURE_PAINT_LIMIT_MS = 300;

let started = false;
function start(): void {
  if (started) return;
  started = true;
  void import('./app/start');
}

/** A promise that also resolves by itself after `limit` ms. */
function within(limit: number, run: (done: () => void) => void): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    setTimeout(done, limit);
    try {
      run(done);
    } catch {
      /* An API this browser lacks: the limit above still ends the wait. */
    }
  });
}

/** The browser has reported painting content. Its paint entries arrive only
 * after the frame was really shown, with the time already in the past. */
function contentPainted(limit: number): Promise<void> {
  return within(limit, (done) => {
    const observer = new PerformanceObserver((list) => {
      if (!list.getEntries().some((entry) => entry.name === 'first-contentful-paint')) return;
      observer.disconnect();
      done();
    });
    observer.observe({ type: 'paint', buffered: true });
  });
}

/** Pictures that load with the page (not lazily) and start on the first screen. */
function firstScreenPictures(): HTMLImageElement[] {
  return Array.from(document.images).filter(
    (img) => img.loading !== 'lazy' && img.getBoundingClientRect().top < window.innerHeight,
  );
}

function loaded(pictures: HTMLImageElement[], limit: number): Promise<void> {
  const waiting = pictures.filter((img) => !img.complete);
  if (waiting.length === 0) return Promise.resolve();
  return within(limit, (done) => {
    let left = waiting.length;
    const one = (): void => {
      left -= 1;
      if (left <= 0) done();
    };
    for (const img of waiting) {
      img.addEventListener('load', one, { once: true });
      img.addEventListener('error', one, { once: true });
    }
  });
}

/**
 * One of these pictures has been reported as the largest thing painted. A
 * picture that has loaded is decoded and painted a frame or two later; when it
 * is the largest thing on the first screen, the browser says so, and that is
 * the moment the first screen is complete. When the text is larger no such
 * report comes, and the limit ends the wait.
 */
function picturePainted(pictures: HTMLImageElement[], limit: number): Promise<void> {
  return within(limit, (done) => {
    const wanted = new Set<Element>(pictures);
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const element = (entry as PerformanceEntry & { element?: Element | null }).element;
        if (!element || !wanted.has(element)) continue;
        observer.disconnect();
        done();
        return;
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  });
}

async function whenFirstScreenIsShown(): Promise<void> {
  await contentPainted(PAINT_LIMIT_MS);
  const pictures = firstScreenPictures();
  if (pictures.length === 0) return;
  await loaded(pictures, PICTURE_LIMIT_MS);
  await picturePainted(pictures, PICTURE_PAINT_LIMIT_MS);
}

if (document.visibilityState === 'hidden') {
  /* A tab opened in the background paints nothing; do not wait for it to. */
  start();
} else {
  void whenFirstScreenIsShown().then(start, start);
}
