import { describe, expect, it } from 'vitest';

import * as drizzle from '#db/drizzle.ts';
import * as db from '#db/index.ts';

describe('db entry point', () => {
  it('exports the drizzle namespaces', () => {
    expect(Object.keys(db).sort()).toEqual(['p', 'q']);
  });

  it('re-exports them from the drizzle module', () => {
    expect(db.p).toBe(drizzle.p);
    expect(db.q).toBe(drizzle.q);
  });
});
