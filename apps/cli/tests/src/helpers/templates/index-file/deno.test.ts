import { describe, expect, it } from 'vitest';

import { denoIndexFileTemplate } from '#helpers/templates/index-file/deno.ts';

describe('denoIndexFileTemplate', () => {
  it('serves the construction unit and does nothing else', () => {
    expect(denoIndexFileTemplate(5000)).toEqualTemplate('index-file', 'deno', 'default.txt');
  });

  describe('when using a different port', () => {
    it('listens on that port', () => {
      expect(denoIndexFileTemplate(8080)).toEqualTemplate('index-file', 'deno', 'with-different-port.txt');
    });
  });
});
