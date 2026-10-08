/**
 * emotion-mini core — hashing, nesting, sheet management, style registration.
 *
 * See vendor/emotion/README.md for the parity contract and known divergences.
 */

import { hash } from './hash';
import { flatten } from './serialize';
import { objectToCss } from './object-styles';

export { hash, flatten, objectToCss };

export type StyleObject = {
  [key: string]:
    | string
    | number
    | null
    | undefined
    | false
    | StyleObject
    | StyleObject[]
    | Array<string | number | StyleObject>;
};

export type StyleValue =
  | string
  | number
  | null
  | undefined
  | false
  | StyleObject
  | StyleValue[];

/**
 * A CSS interpolation.
 *
 * Deliberately NOT part of `StyleValue`: if the union of accepted arguments
 * contained a `((props: any) => ...)` member, TypeScript would match that
 * member first and every `(p) => ...` interpolation in the codebase would bind
 * `p` as implicit `any`, silently defeating the whole token type system. Keeping
 * the function form out of `StyleValue` and adding it per-call-site with a
 * concrete props type is what makes `(p) => p.theme.space[4]` type-checked.
 */
export type Interpolation<TProps extends object> =
  | StyleValue
  | ((props: TProps & { theme: any }) => StyleValue);

export interface SerializedStyle {
  name: string;
  styles: string;
}

/* -------------------------------------------------------------------------- */
/* Style sheet                                                                */
/* -------------------------------------------------------------------------- */

export interface Sheet {
  /** class name -> flattened rule text, insertion ordered (dedupe + prerender). */
  inserted: Map<string, string>;
  container: HTMLElement | null;
  tag: HTMLStyleElement | null;
}

const SHEET_KEY = '__emotionMiniSheet__';

export function getSheet(): Sheet {
  const g = globalThis as Record<string, unknown>;
  const existing = g[SHEET_KEY] as Sheet | undefined;
  if (existing) return existing;
  const created: Sheet = { inserted: new Map(), container: null, tag: null };
  Object.defineProperty(g, SHEET_KEY, { value: created, writable: true, configurable: true });
  return created;
}

/** Render the inserted map into plain CSS text, in insertion order. */
export function sheetToCss(inserted: Map<string, string>): string {
  /* Values carry their own full rule text (selectors included). */
  return [...inserted.values()].join('\n');
}

function writeRule(sheet: Sheet, key: string, styles: string): void {
  /* Always record: during prerender the sheet is the CSS extraction source. */
  if (sheet.inserted.get(key) === styles) return;
  sheet.inserted.set(key, styles);
  if (typeof document === 'undefined') return;

  const container = sheet.container ?? document.head;
  if (!sheet.tag || !container.contains(sheet.tag)) {
    sheet.tag = document.createElement('style');
    sheet.tag.setAttribute('data-emotion', 'mini');
    container.appendChild(sheet.tag);
  }
  sheet.tag.textContent = sheetToCss(sheet.inserted);
}

/** Test/prerender helper: forget all generated CSS. */
export function __resetSheet(): void {
  const sheet = getSheet();
  sheet.inserted.clear();
  if (sheet.tag) sheet.tag.textContent = '';
}

/**
 * R1A-10 fix: on boot, adopt the prerendered <style id="emotion-prerender">
 * as the client sheet's tag instead of minting a second one. Without this the
 * shipped page carries the full critical CSS twice until/unless dedupe
 * (identical bytes, but ~2x CSS bytes in DevTools and a second tag).
 *
 * Safe because names are content-hashes: the client regenerates byte-identical
 * rules, so overwriting textContent on first registration converges to the
 * same sheet. The id attribute is dropped on adoption so a later
 * document.getElementById can't double-target the live tag.
 */
export function adoptPrerenderedTag(el: HTMLElement | null): void {
  if (!el || typeof document === 'undefined') return;
  const sheet = getSheet();
  if (!sheet.tag) {
    el.removeAttribute('id');
    el.setAttribute('data-emotion', 'mini');
    sheet.tag = el as HTMLStyleElement;
    /* inserted stays empty; the first registerStyle overwrites textContent
     * with the client-generated (identical) sheet. */
    return;
  }
  /* The client sheet already exists (module-scope css()/keyframes() run during
   * import evaluation, before main's body). The prerender copy is dead weight
   * — the replace-render regenerates every rule into the live tag — but it
   * must NOT be removed before React's first commit or the window between
   * script-exec and first paint is unstyled. Tag it for removal by the app's
   * root effect (runs after first commit, styles guaranteed in place). */
  if (sheet.tag !== el) el.setAttribute('data-emotion-retire', '');
}

/** Remove the retired prerender <style> — call from a post-commit effect. */
export function retirePrerenderedTag(): void {
  if (typeof document === 'undefined') return;
  for (const el of Array.from(document.querySelectorAll('style[data-emotion-retire]'))) {
    el.remove();
  }
}

/** Test/prerender helper: CSS generated so far, insertion ordered. */
export function __sheetCss(): string {
  return sheetToCss(getSheet().inserted);
}

/* -------------------------------------------------------------------------- */
/* Serialization                                                              */
/* -------------------------------------------------------------------------- */

function isTemplateStrings(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in (value as object);
}

/**
 * Normalize tagged-template call arguments into a flat, correctly interleaved
 * argument list: [strings[0],interp[0],strings[1],interp[1],...,strings[n]].
 *
 * Without this, flattening the TemplateStringsArray first would emit
 * `color: ;red` instead of `color: red` — the pairing of static text with its
 * interpolations would be lost.
 */
export function interpolate(args: unknown[]): StyleValue[] {
  if (!isTemplateStrings(args[0])) return args as StyleValue[];
  const strings = args[0];
  const interpolations = args.slice(1);
  const out: StyleValue[] = [];
  strings.forEach((part, index) => {
    out.push(part);
    if (index < interpolations.length) out.push(interpolations[index] as StyleValue);
  });
  return out;
}

/**
 * Turn Emotion-style arguments (template literals, objects, arrays, theme
 * functions) into one nested CSS string.
 */
export function serializeArgs(args: StyleValue[], theme: unknown): string {
  let out = '';

  const consume = (value: StyleValue): void => {
    /* Falsy values contribute nothing — the Emotion idiom for conditional
     * styles (`${p.$on && css`...`}` and `${cond ? '2rem' : false}`).
     *
     * Applied to a WHOLE interpolated value, so a declaration whose value is
     * entirely a skipped falsy interpolation collapses to `prop: ;` — which
     * parse() rejects as an empty value, rather than emitting CSS the browser
     * silently drops. Only a genuinely empty interpolation throws, and the
     * error names the property. */
    if (value === null || value === undefined || value === false) return;
    if (typeof value === 'number') {
      out += String(value);
      return;
    }
    if (typeof value === 'string') {
      out += value;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value as StyleValue[]) consume(item);
      return;
    }
    if (typeof value === 'function') {
      consume((value as (p: unknown) => StyleValue)(theme));
      return;
    }
    if (typeof value === 'object') {
      out += objectToCss(value as Record<string, never>);
      return;
    }
    throw new Error(`[emotion-mini] unsupported style argument of type ${typeof value}`);
  };

  for (const arg of args) consume(arg);
  return out;
}

/**
 * Serialize a styled component's styles for a concrete props object.
 *
 * The class name is a hash of the resolved rule text, exactly like Emotion: two
 * instances of one component with different dynamic props get two class names,
 * and identical rules dedupe to one class regardless of which component produced
 * them. Prerender and client therefore agree without sharing any counter state.
 */
export function serializeStyles(
  displayName: string,
  args: StyleValue[],
  props: Record<string, unknown>,
): SerializedStyle {
  const nested = serializeArgs(args, props);
  if (!nested.trim()) return { name: '', styles: '' };

  const name = hash(`${displayName}{${nested}}`);
  const styles = flatten(nested, `.css-${name}`);
  return { name, styles };
}

/**
 * Register a flattened rule under `.css-<name>` and return the class name.
 * Idempotent: re-registering identical text is free, and because the name is
 * derived from the text, a changed rule always yields a fresh class.
 */
export function registerStyle(name: string, styles: string): string {
  if (!name || !styles) return '';
  writeRule(getSheet(), `.css-${name}`, styles);
  return `css-${name}`;
}

/** Register a raw rule (Global styles, `@keyframes`, `@font-face`) verbatim. */
export function registerRaw(key: string, css: string): void {
  writeRule(getSheet(), key, css);
}

/** Allocate a unique keyframe name and register the rule once.
 *  R1A-03 fix: the CACHE only stabilizes the name (hash-derived anyway);
 *  registration is re-checked against the sheet every call, so a route/test
 *  that resets the sheet re-registers the rule instead of shipping the name
 *  with no matching @keyframes text. */
const keyframeCache = new Map<string, string>();
export function registerKeyframes(nested: string): string {
  const trimmed = nested.trim();
  const name = keyframeCache.get(trimmed) ?? `animation-${hash(trimmed)}`;
  keyframeCache.set(trimmed, name);
  const rule = flatten(`@keyframes ${name}{${trimmed}}`, '');
  registerRaw(`@keyframes ${name}`, rule);
  return name;
}

/** Reset for tests: also clears the class-name cache. */
export function __clearAll(): void {
  __resetSheet();
}
