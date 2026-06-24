import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TempDir {
  path: string;
  write: (relativePath: string, contents: string) => string;
  mkdir: (relativePath: string) => string;
  read: (relativePath: string) => string;
  exists: (relativePath: string) => boolean;
  cleanup: () => void;
}

export const createTempDir = (): TempDir => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'typebase-cli-test-'));

  const resolve = (relativePath: string) => path.join(root, relativePath);

  return {
    path: root,
    write: (relativePath, contents) => {
      const filePath = resolve(relativePath);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, contents, 'utf8');

      return filePath;
    },
    mkdir: (relativePath) => {
      const dirPath = resolve(relativePath);

      fs.mkdirSync(dirPath, { recursive: true });

      return dirPath;
    },
    read: (relativePath) => {
      return fs.readFileSync(resolve(relativePath), 'utf8');
    },
    exists: (relativePath) => {
      return fs.existsSync(resolve(relativePath));
    },
    cleanup: () => {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
};

export const withCwd = async <T>(dir: string, fn: () => T | Promise<T>): Promise<T> => {
  const original = process.cwd();

  process.chdir(dir);

  try {
    return await fn();
  } finally {
    process.chdir(original);
  }
};
