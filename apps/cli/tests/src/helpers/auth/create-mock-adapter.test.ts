import { describe, expect, it } from 'vitest';

import { createMockAdapter } from '#helpers/auth/create-mock-adapter.ts';

describe('createMockAdapter', () => {
  it('describes a plural pg drizzle adapter', () => {
    const adapter = createMockAdapter();

    expect(adapter.id).toBe('drizzle');

    expect(adapter.options).toEqual({
      adapterConfig: { adapterId: 'drizzle', usePlural: true },
      provider: 'pg',
    });
  });

  it('exposes operation methods that throw when invoked', () => {
    const adapter = createMockAdapter();

    const methods = ['create', 'findOne', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany', 'consumeOne', 'transaction'] as const;

    for (const method of methods) {
      expect(() => (adapter[method] as () => unknown)()).toThrow('mock');
    }
  });
});
