import { describe, expect, it } from 'vitest';

import * as server from '#server/index.ts';
import * as localStorage from '#server/storage/local-storage/index.ts';

describe('server local storage entry point', () => {
  it('exports the local storage api', () => {
    expect(Object.keys(localStorage).sort()).toEqual(['createLocalStorage', 'handleNodeRequest']);
  });

  it('keeps local storage out of the main server entry point', () => {
    expect(server).not.toHaveProperty('createLocalStorage');
    expect(server).not.toHaveProperty('handleNodeRequest');
  });
});
