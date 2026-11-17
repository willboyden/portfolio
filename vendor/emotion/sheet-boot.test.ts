/**
 * The client sheet on a prerendered page (R1A-10 and after).
 *
 * A prerendered page arrives with its stylesheet in a <style> tag. The client
 * adopts that tag as a fixed BASE and never writes to it: assigning a style
 * element's text makes the browser parse all of it again, and replacing the
 * page's stylesheet with "the rules registered so far" would un-style
 * whatever the client has not rendered yet. A rule the client registers is
 * looked up in the base text (names are content hashes, so a rule the server
 * rendered is there verbatim); only a rule the base lacks is written, into a
 * second, small <style>, and during boot not until the first commit.
 *
 * No DOM library is available offline, so the document is a small stand-in
 * that counts what matters: assignments to a style element's text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSheet,
  adoptPrerenderedTag,
  completeStyleBoot,
  getSheet,
  registerRaw,
  retirePrerenderedTag,
} from '@emotion-mini/core';

class FakeStyle {
  attrs = new Map<string, string>();
  writes = 0;
  parent: FakeHead | null = null;
  #text = '';
  constructor(text = '') {
    this.#text = text;
  }
  get textContent(): string {
    return this.#text;
  }
  set textContent(value: string) {
    this.writes += 1;
    this.#text = value;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  remove(): void {
    this.parent?.children.delete(this);
    this.parent = null;
  }
}

class FakeHead {
  children = new Set<FakeStyle>();
  appendChild(el: FakeStyle): FakeStyle {
    this.children.add(el);
    el.parent = this;
    return el;
  }
  contains(el: FakeStyle): boolean {
    return this.children.has(el);
  }
}

let head: FakeHead;

function prerenderedTag(text: string): FakeStyle {
  const tag = new FakeStyle(text);
  tag.setAttribute('id', 'emotion-prerender');
  head.appendChild(tag);
  return tag;
}

function resetSheet(): void {
  const sheet = getSheet();
  sheet.inserted.clear();
  sheet.tag = null;
  sheet.base = null;
  sheet.late = new Map();
  sheet.lateTag = null;
  sheet.booting = false;
}

beforeEach(() => {
  head = new FakeHead();
  vi.stubGlobal('document', {
    head,
    createElement: () => new FakeStyle(),
    querySelectorAll: (selector: string) =>
      selector === 'style[data-emotion-retire]'
        ? [...head.children].filter((el) => el.attrs.has('data-emotion-retire'))
        : [],
  });
  resetSheet();
});

afterEach(() => {
  resetSheet();
  vi.unstubAllGlobals();
});

/** The second tag, if one was made. */
function lateTag(): FakeStyle | undefined {
  return [...head.children].find((el) => el.getAttribute('data-emotion') === 'mini-late');
}

const A = '.css-a {color:red;}';
const B = '.css-b {color:blue;}';
const C = '.css-c {color:green;}';

describe('without a prerendered sheet (the dev server)', () => {
  it('writes each new rule as it is registered, into one tag it creates', () => {
    registerRaw('a', A);
    registerRaw('b', B);
    expect(head.children.size).toBe(1);
    const [tag] = [...head.children];
    expect(tag?.getAttribute('data-emotion')).toBe('mini');
    expect(tag?.textContent).toBe(`${A}\n${B}`);
    expect(tag?.writes).toBe(2);
  });

  it('registering the same rule again touches nothing', () => {
    registerRaw('a', A);
    const [tag] = [...head.children];
    registerRaw('a', A);
    expect(tag?.writes).toBe(1);
  });
});

describe('a prerendered page: the adopted sheet is a fixed base', () => {
  it('adoption takes the tag over without writing to it, and starts boot', () => {
    const tag = prerenderedTag(`${A}\n${B}`);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    expect(getSheet().tag).toBe(tag);
    expect(getSheet().base).toBe(`${A}\n${B}`);
    expect(getSheet().booting).toBe(true);
    expect(tag.getAttribute('id')).toBeNull();
    expect(tag.getAttribute('data-emotion')).toBe('mini');
    expect(tag.writes).toBe(0);
  });

  it('a rule the server already rendered costs nothing: no write, during boot or after', () => {
    const tag = prerenderedTag(`${A}\n${B}`);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    registerRaw('a', A);
    completeStyleBoot();
    /* B belongs to a part of the page the client gets to later (adopted in a
     * later step). Its styles were never taken away, and registering it now
     * still writes nothing. */
    expect(tag.textContent).toBe(`${A}\n${B}`);
    registerRaw('b', B);
    expect(tag.writes).toBe(0);
    expect(head.children.size).toBe(1);
    expect(lateTag()).toBeUndefined();
  });

  it('completing boot never rewrites the base, whatever subset of it the client has registered', () => {
    const tag = prerenderedTag(`${A}\n${B}`);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    /* Nothing registered at all (everything adopted later): the page keeps
     * every style it arrived with. */
    completeStyleBoot();
    expect(tag.writes).toBe(0);
    expect(tag.textContent).toBe(`${A}\n${B}`);
    expect(getSheet().booting).toBe(false);
  });

  it('a rule the base lacks is held during boot, then written once, into a second tag after the base', () => {
    const tag = prerenderedTag(`${A}\n${B}`);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    registerRaw('a', A);
    registerRaw('c', C);
    expect(head.children.size).toBe(1);
    completeStyleBoot();
    const late = lateTag();
    expect(late).toBeDefined();
    expect(late?.textContent).toBe(C);
    expect(late?.writes).toBe(1);
    expect(tag.writes).toBe(0);
    /* Document order: base, then late (a later rule wins a tie). */
    expect([...head.children]).toEqual([tag, late]);
  });

  it('after boot a new rule is written at once, and only the small second tag is rewritten', () => {
    const tag = prerenderedTag(A);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    registerRaw('a', A);
    completeStyleBoot();
    registerRaw('b', B);
    registerRaw('c', C);
    const late = lateTag();
    expect(late?.textContent).toBe(`${B}\n${C}`);
    expect(late?.writes).toBe(2);
    expect(tag.writes).toBe(0);
    expect(tag.textContent).toBe(A);
  });

  it('exactly one tag is "the page\u2019s stylesheet"; the late one is marked as its own', () => {
    const tag = prerenderedTag(A);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    registerRaw('b', B);
    completeStyleBoot();
    const marks = [...head.children].map((el) => el.getAttribute('data-emotion'));
    expect(marks).toEqual(['mini', 'mini-late']);
  });

  it('no rule is in the document twice', () => {
    const tag = prerenderedTag(`${A}\n${B}`);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    for (const [key, rule] of [
      ['a', A],
      ['b', B],
      ['c', C],
      ['a', A],
    ] as const) {
      registerRaw(key, rule);
    }
    completeStyleBoot();
    const all = [...head.children].map((el) => el.textContent).join('\n');
    for (const rule of [A, B, C]) expect(all.split(rule).length - 1, rule).toBe(1);
  });

  it('completing boot twice, or with no boot in progress, is harmless', () => {
    const tag = prerenderedTag(A);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    registerRaw('a', A);
    completeStyleBoot();
    completeStyleBoot();
    retirePrerenderedTag();
    expect(tag.writes).toBe(0);
    expect(head.children.size).toBe(1);
  });

  it('a tag the client made before adoption is dropped; what the base lacks of it becomes late', () => {
    /* Module-scope registrations during import, before main's body runs. */
    registerRaw('early', C);
    registerRaw('a', A);
    const early = getSheet().tag as unknown as FakeStyle;
    expect(head.children.has(early)).toBe(true);
    const tag = prerenderedTag(`${A}\n${B}`);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    expect(head.children.has(early)).toBe(false);
    completeStyleBoot();
    expect(tag.writes).toBe(0);
    /* C was not in the base: it is written. A was: it is not written again. */
    expect(lateTag()?.textContent).toBe(C);
  });

  it('adopting nothing (no prerendered tag) starts no boot', () => {
    adoptPrerenderedTag(null);
    expect(getSheet().booting).toBeFalsy();
    registerRaw('a', A);
    expect(head.children.size).toBe(1);
    expect([...head.children][0]?.textContent).toBe(A);
  });

  it('a tag marked for retirement by older code is still removed', () => {
    const stale = new FakeStyle('old');
    stale.setAttribute('data-emotion-retire', '');
    head.appendChild(stale);
    completeStyleBoot();
    expect(head.children.has(stale)).toBe(false);
  });

  it('the reset helper also ends a boot and forgets the base', () => {
    const tag = prerenderedTag(A);
    adoptPrerenderedTag(tag as unknown as HTMLElement);
    __resetSheet();
    expect(getSheet().booting).toBe(false);
    expect(getSheet().base).toBeNull();
    expect(getSheet().inserted.size).toBe(0);
  });
});
