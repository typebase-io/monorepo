import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertNotMigrationsMode } from '#helpers/db/assert-not-migrations-mode.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('assertNotMigrationsMode', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const assert = (migrationsDirPath: string, target: 'dev' | 'prod' | 'local') => {
    return () => {
      assertNotMigrationsMode({ migrationsDirPath, target });
    };
  };

  it('does nothing when the project has no migrations directory', () => {
    expect(assert(path.join(tmp.path, 'db', 'migrations'), 'dev')).not.toThrow();
  });

  it.each(['dev', 'prod', 'local'] as const)('names the migrate command for the %s target', (target) => {
    expect(assert(tmp.mkdir('db/migrations'), target)).toThrow(`Run \`db ${target} migrate\` to apply your migrations instead.`);
  });

  it('explains that pushing would go unrecorded', () => {
    expect(assert(tmp.mkdir('db/migrations'), 'dev')).toThrow(
      'This project uses migrations, so pushing would change the schema without recording it.'
    );
  });
});
