import { realpathSync } from 'node:fs';
import path from 'node:path';

export const canonicalizePath = (target: string): string => {
  try {
    return realpathSync(target);
  } catch {
    const parent = path.dirname(target);

    if (parent === target) {
      return target;
    }

    return path.join(canonicalizePath(parent), path.basename(target));
  }
};
