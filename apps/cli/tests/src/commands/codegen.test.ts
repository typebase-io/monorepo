import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { codegen } from '#commands/codegen.ts';

import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { listFiles } from '#tests/helpers/list-files.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const { passThrough } = vi.hoisted(() => ({
  passThrough: (actual: Record<string, unknown>): Record<string, unknown> => {
    const mocked = { ...actual };

    for (const [key, value] of Object.entries(actual)) {
      if (typeof value === 'function') mocked[key] = vi.fn(value as (...args: unknown[]) => unknown);
    }

    return mocked;
  },
}));

vi.mock('#helpers/shared/generate-db-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-server-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/get-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

describe('codegen command', () => {
  let tmp: TempDir;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmp = createTempDir();

    linkTypebaseIo(tmp);

    await generateTypebaseProject(tmp);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('generates the db and server type definitions from the project', async () => {
    await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

    expect(listFiles(path.join(tmp.path, 'typebase', '_generated'))).toEqual(['db.d.ts', 'server.ts']);
    expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
    expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');
  });

  it('builds a nested router mirroring the actions folder structure', async () => {
    fs.rmSync(path.join(tmp.path, 'typebase/actions'), { recursive: true, force: true });

    const actions = ['ping.ts', 'admin/settings.ts', 'admin/users/list.ts', 'admin/users/remove.ts', 'billing/invoices/create.ts'];

    for (const rel of actions) {
      const up = '../'.repeat(rel.split('/').length);
      tmp.write(
        `typebase/actions/${rel}`,
        `import { action } from "${up}_generated/server.ts";\n\nexport const handler = action.handler(async () => "ok");\n`
      );
    }

    await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

    expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'nested-server.ts.txt');
  });

  describe('regenerates over existing output when the project changes', () => {
    it('reflects action files being added and then removed', async () => {
      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');

      tmp.write(
        'typebase/actions/reports/daily.ts',
        'import { action } from "../../_generated/server.ts";\n\nexport const handler = action.handler(async () => "ok");\n'
      );

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'after-adding-new-action-server.ts.txt');

      fs.rmSync(path.join(tmp.path, 'typebase/actions'), { recursive: true, force: true });

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'after-removing-all-actions-server.ts.txt');
    });

    it('reflects auth being removed and then added back', async () => {
      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');

      const authFile = tmp.read('typebase/auth.ts');

      fs.rmSync(path.join(tmp.path, 'typebase/auth.ts'));

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'after-removing-auth-db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'after-removing-auth-server.ts.txt');

      tmp.write('typebase/auth.ts', authFile);

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');
    });

    it('reflects the db being removed and then added back', async () => {
      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');

      const schemaFile = tmp.read('typebase/db/schema.ts');

      fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_generated/db.d.ts')).toBe(false);
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'after-removing-db-server.ts.txt');

      tmp.write('typebase/db/schema.ts', schemaFile);

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');
    });
  });

  it('reports type errors but still generates types', async () => {
    await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

    expect(console.error).toHaveBeenCalled();
    expect(tmp.exists('typebase/_generated/db.d.ts')).toBe(true);
    expect(tmp.exists('typebase/_generated/server.ts')).toBe(true);
  });

  describe('propagates failures', () => {
    const cases: { name: string; mock: () => { mockRejectedValueOnce: (e: Error) => unknown } }[] = [
      { name: 'getTypebaseConfig', mock: () => vi.mocked(getTypebaseConfig) },
      { name: 'generateDBTypes', mock: () => vi.mocked(generateDBTypes) },
      { name: 'generateServerTypes', mock: () => vi.mocked(generateServerTypes) },
    ];

    it.each(cases)('rejects when $name throws', async ({ mock }) => {
      mock().mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }))).rejects.toThrow('boom');
    });
  });
});
