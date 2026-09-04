import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SERVER_MARKER_FILE_NAME, serverMarkerSchema } from '#helpers/constants.ts';

export const getGeneratedServerDirPaths = (dirPath: string, sourceFilePaths: string[]) => {
  const rootPrefix = `${path.resolve(dirPath)}${path.sep}`;
  const visited = new Set<string>();
  const generatedDirPaths: string[] = [];

  for (const filePath of sourceFilePaths) {
    let currentDir = path.dirname(filePath);

    while (currentDir.startsWith(rootPrefix) && !visited.has(currentDir)) {
      visited.add(currentDir);

      try {
        const marker: unknown = JSON.parse(readFileSync(path.join(currentDir, SERVER_MARKER_FILE_NAME), 'utf8'));

        if (serverMarkerSchema.safeParse(marker).success) {
          generatedDirPaths.push(currentDir);

          break;
        }
      } catch {
        // Missing or malformed markers do not make user source generated output.
      }

      currentDir = path.dirname(currentDir);
    }
  }

  return generatedDirPaths;
};
