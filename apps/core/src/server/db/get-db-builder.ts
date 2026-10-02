import type { AnyRelations } from 'drizzle-orm';

import type { DB } from '#server/actions/types.ts';

export type GetDBBuilder<TRelations extends AnyRelations> = () => DB<TRelations>;
