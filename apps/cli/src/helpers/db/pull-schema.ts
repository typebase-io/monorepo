import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export const pullSchema = async ({ connectionUri }: { connectionUri: string }): Promise<{ schema: string; relations: string }> => {
  const outDirPath = await fs.mkdtemp(path.join(tmpdir(), 'typebase-db-pull-'));

  try {
    const args = [
      path.join(path.dirname(createRequire(import.meta.url).resolve('drizzle-kit')), 'bin.cjs'),
      'pull',
      '--dialect',
      'postgresql',
      '--url',
      connectionUri,
      '--out',
      outDirPath,
      '--introspect-casing',
      'camel',
    ];

    try {
      await promisify(execFile)(process.execPath, args);
    } catch (error) {
      const { stderr, stdout } = error as { stderr?: string; stdout?: string };
      const details = [stderr, stdout].map((output) => output?.trim()).find((output) => output);

      throw new Error(`Could not read the schema from that database.${details ? `\n\n${details}` : ''}`);
    }

    const [schema, relations] = await Promise.all([
      fs.readFile(path.join(outDirPath, 'schema.ts'), 'utf8'),
      fs.readFile(path.join(outDirPath, 'relations.ts'), 'utf8'),
    ]);

    return { schema, relations };
  } finally {
    await fs.rm(outDirPath, { recursive: true, force: true });
  }
};
