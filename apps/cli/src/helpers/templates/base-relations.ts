export const baseRelationsTemplate = `import { q } from 'typebase-io/db';

import * as schema from './schema.js';

export const relations = q.defineRelations(schema, (r) => ({}));`;
