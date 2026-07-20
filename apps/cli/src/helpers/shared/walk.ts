import fs from 'node:fs';
import path from 'node:path';

export const walk = async (
  dir: string,
  options?: {
    recursive?: boolean;
    filter?: (filePath: string) => boolean;
    skipDirs?: (dirName: string) => boolean;
  }
): Promise<string[]> => {
  const recursive = options?.recursive ?? true;
  const filter = options?.filter;
  const skipDirs = options?.skipDirs ?? ((name) => name === 'node_modules' || name === 'dist' || name === 'build');

  const out: string[] = [];

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return out;
  }

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const ent of entries) {
    const full = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (!recursive) continue;

      if (skipDirs(ent.name)) continue;

      out.push(...(await walk(full, options)));
    } else if (ent.isFile()) {
      if (!filter || filter(full)) {
        out.push(full);
      }
    }
  }

  return out;
};
