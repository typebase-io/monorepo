import { describe, expect, it } from 'vitest';

import { nodeIndexFileTemplate } from '#helpers/templates/index-file/node.ts';

describe('nodeIndexFileTemplate', () => {
  it('starts the construction unit listening and does nothing else', () => {
    expect(nodeIndexFileTemplate(7000)).toEqualTemplate('index-file', 'node', 'default.txt');
  });

  describe('when using a different port', () => {
    it('listens on that port', () => {
      expect(nodeIndexFileTemplate(8080)).toEqualTemplate('index-file', 'node', 'with-different-port.txt');
    });
  });
});
