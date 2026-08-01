import { os } from '@orpc/server';
import { describe, expect, it } from 'vitest';

import { filterActions } from '#server/actions/filter-actions.ts';

describe('filterActions', () => {
  it('returns the module untouched at runtime', () => {
    const procedure = os.handler(async () => 'hello');
    const module = { procedure, helper: () => 'not an action' };

    expect(filterActions(module)).toBe(module);
  });

  it('accepts a module with no actions', () => {
    const module = { CONSTANT: 1 };

    expect(filterActions(module)).toBe(module);
  });
});
