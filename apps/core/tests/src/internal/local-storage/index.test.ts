import { describe, expect, it } from 'vitest';

import * as server from '#server/index.ts';

import * as internal from '#internal/index.ts';
import * as localStorage from '#internal/local-storage/index.ts';

describe('internal local storage entry point', () => {
  it('exports the local storage api', () => {
    expect(Object.keys(localStorage).sort()).toEqual(['createLocalStorage', 'handleNodeRequest']);
  });

  it('keeps local storage out of the server and internal entry points', () => {
    expect(server).not.toHaveProperty('createLocalStorage');
    expect(server).not.toHaveProperty('handleNodeRequest');
    expect(internal).not.toHaveProperty('createLocalStorage');
    expect(internal).not.toHaveProperty('handleNodeRequest');
  });
});
