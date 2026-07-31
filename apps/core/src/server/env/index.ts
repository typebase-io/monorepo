import { type StandardSchemaDictionary, createEnv } from '@t3-oss/env-core';

export interface DefineEnvOptions {
  emptyStringAsUndefined?: boolean;
  skipValidation?: boolean;
}

export const defineEnv = <TSchema extends StandardSchemaDictionary>(schema: TSchema, options: DefineEnvOptions = {}) => {
  return createEnv<undefined, TSchema>({
    server: schema,
    runtimeEnv: process.env,
    emptyStringAsUndefined: options.emptyStringAsUndefined ?? true,
    skipValidation: options.skipValidation ?? false,
  });
};
