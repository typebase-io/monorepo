import { type DBAdapter } from 'auth/api';

export const createMockAdapter = (): DBAdapter => {
  const noop = () => {
    throw new Error('mock');
  };

  return {
    id: 'drizzle',
    create: noop,
    findOne: noop,
    findMany: noop,
    count: noop,
    update: noop,
    updateMany: noop,
    delete: noop,
    deleteMany: noop,
    consumeOne: noop,
    transaction: noop,
    options: {
      adapterConfig: { adapterId: 'drizzle', usePlural: true },
      provider: 'pg',
    },
  } as DBAdapter;
};
