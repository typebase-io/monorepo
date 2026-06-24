import fs from 'node:fs';
import path from 'node:path';

export const listFiles = (base: string): string[] => {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(path.relative(base, full).replace(/\\/g, '/'));
      }
    }
  };

  if (fs.existsSync(base)) {
    walk(base);
  }

  return files.sort();
};
