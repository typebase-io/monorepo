import fs from 'node:fs/promises';
import path from 'node:path';

import { SERVER_MARKER_FILE_NAME, type ServerAdapter, type ServerMarkerSchema, type ServerMode } from '#helpers/constants.ts';
import { getCliVersion } from '#helpers/shared/get-cli-version.ts';

export const generateMarkerFile = async ({
  outputDirPath,
  adapter,
  mode,
  dependencies,
  devDependencies,
  envKeys,
}: {
  outputDirPath: string;
  adapter: ServerAdapter;
  mode: ServerMode;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  envKeys: string[];
}) => {
  const marker: ServerMarkerSchema = {
    adapter,
    mode,
    cliVersion: getCliVersion() ?? 'unknown',
    dependencies,
    devDependencies,
    envKeys,
  };

  await fs.mkdir(outputDirPath, { recursive: true });
  await fs.writeFile(path.join(outputDirPath, SERVER_MARKER_FILE_NAME), `${JSON.stringify(marker, null, 2)}\n`);
};
