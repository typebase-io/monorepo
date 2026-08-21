/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { type PublisherDatabase } from '#server/publisher/providers/db.ts';

interface Row {
  id: number;
  name: string;
  value: unknown;
}

export const fakePublisherDatabase = () => {
  const rows: Row[] = [];
  const state = { selects: 0 };

  const db = {
    select: (columns: Record<string, unknown>) => {
      state.selects += 1;

      const latestOnly = Object.keys(columns).length === 1;
      let limit = Number.POSITIVE_INFINITY;

      const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (value: number) => {
          limit = value;

          return chain;
        },
        then: (resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) => {
          const result = latestOnly ? [{ id: rows.at(-1)?.id ?? 0, name: '', value: undefined }] : rows.slice(0, limit);

          return Promise.resolve(result).then(resolve, reject);
        },
      };

      return chain;
    },
    insert: () => ({
      values: ({ name, value }: { name: string; value: unknown }) => {
        rows.push({ id: rows.length + 1, name, value });

        return Promise.resolve();
      },
    }),
  } as unknown as PublisherDatabase;

  return {
    db,
    rows,
    get selectCount() {
      return state.selects;
    },
  };
};
