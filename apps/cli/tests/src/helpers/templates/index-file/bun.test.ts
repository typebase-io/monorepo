import { describe, expect, it } from 'vitest';

import { bunIndexFileTemplate } from '#helpers/templates/index-file/bun.ts';

describe('bunIndexFileTemplate', () => {
  it('serves the construction unit and does nothing else', () => {
    expect(bunIndexFileTemplate(4000)).toEqualTemplate('index-file', 'bun', 'default.txt');
  });

  describe('when using a different port', () => {
    it('listens on that port', () => {
      expect(bunIndexFileTemplate(8080)).toEqualTemplate('index-file', 'bun', 'with-different-port.txt');
    });
  });
});
