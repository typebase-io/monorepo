import { generateDrizzleJson } from 'drizzle-kit/api-postgres';

import { type ServerProvider } from '#helpers/constants.ts';
import { buildSchema } from '#helpers/db/build-schema.ts';
import { importSchema } from '#helpers/db/import-schema.ts';

export const buildSnapshot = async ({
  dbDirPath,
  serverProvider,
  prevId,
  quiet,
}: {
  dbDirPath: string;
  serverProvider: ServerProvider | undefined;
  prevId: string | undefined;
  quiet?: boolean;
}) => {
  const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider, quiet });

  try {
    return await generateDrizzleJson(await importSchema({ serverDistDirPath }), prevId, undefined, 'snake_case');
  } finally {
    await cleanup();
  }
};
