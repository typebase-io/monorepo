import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pulledSourcesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pulled-sources');

export const readPulledSource = (name: string) => {
  return readFileSync(path.join(pulledSourcesRoot, name), 'utf8');
};
