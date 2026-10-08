/**
 * Test registry shared between the runner and spec files.
 * Spec files: `import { describe, test } from '../harness/framework.mjs'`.
 */

export const registry = [];
let currentSuite = null;

export function describe(name, fn) {
  const parent = currentSuite;
  currentSuite = parent ? `${parent} > ${name}` : name;
  fn();
  currentSuite = parent;
}

export function test(name, fn) {
  registry.push({ name: currentSuite ? `${currentSuite} > ${name}` : name, fn, suite: currentSuite });
}

export function it(name, fn) {
  test(name, fn);
}
