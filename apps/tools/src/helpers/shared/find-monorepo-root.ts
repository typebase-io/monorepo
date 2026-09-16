import { access } from 'node:fs/promises';
import path from 'node:path';

export const findMonorepoRoot = async (startDir: string): Promise<string> => {
  let dir = startDir;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      await access(path.join(dir, 'pnpm-workspace.yaml'));

      return dir;
    } catch {
      const parent = path.dirname(dir);

      if (parent === dir) {
        throw new Error(`Could not find monorepo root (no pnpm-workspace.yaml found above ${startDir})`);
      }

      dir = parent;
    }
  }
};
