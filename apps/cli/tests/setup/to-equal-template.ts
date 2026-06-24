import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'vitest';

interface CustomMatchers<R = unknown> {
  toEqualTemplate: (...segments: string[]) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

const expectedTemplatesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '/helpers', 'expected-templates');

expect.extend({
  toEqualTemplate(received: unknown, ...segments: string[]) {
    const fixture = segments.join('/');
    const expected = readFileSync(path.join(expectedTemplatesRoot, ...segments), 'utf8');
    const pass = received === expected;

    return {
      pass,
      message: () => `expected output to ${pass ? 'not ' : ''}equal template fixture "${fixture}"`,
      actual: received,
      expected,
    };
  },
});
