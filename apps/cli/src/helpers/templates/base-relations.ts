export const baseRelationsTemplate = (withPublisher: boolean) => `import { q } from "typebase-io/db";

import * as schema from "./schema.ts";

export const relations = q.defineRelations(schema, (r) => ({${withPublisher ? '\n  events: {},\n' : ''}}));`;
