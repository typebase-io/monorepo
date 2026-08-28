import fs from 'node:fs';
import path from 'node:path';

import { confirm } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '#commands/auth.ts';
import { codegen } from '#commands/codegen.ts';
import { db } from '#commands/db.ts';
import { deploy } from '#commands/deploy.ts';
import { generateServer } from '#commands/generate-server.ts';
import { init } from '#commands/init.ts';

import { applyMigrations } from '#helpers/db/apply-migrations.ts';
import { markMigrationApplied } from '#helpers/db/mark-migration-applied.ts';
import { findNeonTarget } from '#helpers/db/neon/find-neon-target.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pullSchema } from '#helpers/db/pull-schema.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { vercel } from '#helpers/deploy/vercel/index.ts';
import { getVercelEnvVar } from '#helpers/env/vercel.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { linkZod } from '#tests/helpers/link-zod.ts';
import { readPulledSource } from '#tests/helpers/read-pulled-source.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const tracker = vi.hoisted(() => {
  const state = { active: 0, overlaps: [] as string[] };

  const create = (text: string) => {
    let spinning = false;

    const spinner = {
      text,
      start(nextText?: string) {
        if (nextText !== undefined) {
          spinner.text = nextText;
        }

        if (spinning) {
          return spinner;
        }

        if (state.active > 0) {
          state.overlaps.push(spinner.text);
        }

        state.active += 1;
        spinning = true;

        return spinner;
      },
      stop() {
        if (spinning) {
          state.active -= 1;
          spinning = false;
        }

        return spinner;
      },
      succeed: () => spinner.stop(),
      fail: () => spinner.stop(),
      warn: () => spinner.stop(),
      info: () => spinner.stop(),
    };

    return spinner;
  };

  return { state, create };
});

vi.mock('ora', () => ({
  default: vi.fn((options?: string | { text?: string }) => tracker.create(typeof options === 'string' ? options : (options?.text ?? ''))),
}));

vi.mock('#helpers/shared/validate-types.ts', () => ({ validateTypes: vi.fn() }));
vi.mock('#helpers/db/apply-migrations.ts', () => ({ applyMigrations: vi.fn() }));
vi.mock('#helpers/db/mark-migration-applied.ts', () => ({ markMigrationApplied: vi.fn() }));
vi.mock('#helpers/db/neon/find-neon-target.ts', () => ({ findNeonTarget: vi.fn() }));
vi.mock('#helpers/db/neon/index.ts', () => ({ neon: vi.fn() }));
vi.mock('#helpers/db/push-schema.ts', () => ({ pushSchema: vi.fn() }));
vi.mock('#helpers/db/pull-schema.ts', () => ({ pullSchema: vi.fn() }));
vi.mock('#helpers/deploy/vercel/index.ts', () => ({ vercel: vi.fn() }));
vi.mock('#helpers/env/vercel.ts', () => ({ getVercelEnvVar: vi.fn() }));

const withPriority = `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`;

describe('concurrent spinners', () => {
  let tmp: TempDir;

  const run = (command: { parseAsync: (argv: string[], options: { from: 'user' }) => Promise<unknown> }, ...argv: string[]) =>
    withCwd(tmp.path, () => command.parseAsync(argv, { from: 'user' }));

  const enterMigrationsMode = async () => {
    tmp.mkdir('typebase/db/migrations');

    await run(db, 'migrations', 'generate', '--name', 'initial');
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker.state.active = 0;
    tracker.state.overlaps = [];

    tmp = createTempDir();

    linkTypebaseIo(tmp);
    linkBetterAuth(tmp);
    linkZod(tmp);

    vi.mocked(neon).mockResolvedValue({ projectId: 'proj-1', branchId: 'br-1', connectionUri: 'postgres://neon/db' });
    vi.mocked(pushSchema).mockResolvedValue({ sqlStatements: [] });
    vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_initial'] });
    vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
    vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });
    vi.mocked(getVercelEnvVar).mockResolvedValue(undefined);
    vi.mocked(vercel).mockResolvedValue({ deploymentId: 'dep_1', url: 'https://app.example.com' });
    vi.mocked(pullSchema).mockResolvedValue({ schema: readPulledSource('schema.ts.txt'), relations: readPulledSource('relations.ts.txt') });
    vi.mocked(confirm).mockResolvedValue(true);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  const expectNoOverlap = () => {
    expect(tracker.state.overlaps).toEqual([]);
    expect(tracker.state.active).toBe(0);
  };

  describe('init', () => {
    it.each([
      { name: 'plain', args: [] as string[] },
      { name: 'with migrations', args: ['--with-migrations'] },
      { name: 'with migrations and auth', args: ['--with-migrations', '--with-auth'] },
      { name: 'with migrations and the publisher', args: ['--with-migrations', '--with-db-publisher'] },
      { name: 'with migrations and no example', args: ['--with-migrations', '--skip-example'] },
    ])('runs one spinner at a time: $name', async ({ args }) => {
      await run(init, ...args);

      expectNoOverlap();
    });
  });

  describe('db in push mode', () => {
    beforeEach(async () => {
      await generateTypebaseProject(tmp, { withAuth: false });
    });

    it.each([
      { name: 'dev push', argv: ['dev', 'push'] },
      { name: 'local push', argv: ['local', 'push', '--url', 'postgres://local/db'] },
      { name: 'pull', argv: ['pull', '--url', 'postgres://source/db', '--force'] },
    ])('runs one spinner at a time: $name', async ({ argv }) => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await run(db, ...argv);

      expectNoOverlap();
    });

    it('runs one spinner at a time: migrations init', async () => {
      await run(db, 'migrations', 'init');

      expectNoOverlap();
    });

    it('runs one spinner at a time: migrations init with an out-of-step target', async () => {
      vi.mocked(pushSchema).mockResolvedValueOnce({ sqlStatements: ['ALTER TABLE "todos" ADD COLUMN "priority" integer;'] });

      await run(db, 'migrations', 'init');

      expectNoOverlap();
    });
  });

  describe('db in migrations mode', () => {
    beforeEach(async () => {
      await generateTypebaseProject(tmp, { withAuth: false });
      await enterMigrationsMode();

      tracker.state.overlaps = [];
    });

    it.each([
      { name: 'migrations generate', argv: ['migrations', 'generate', '--name', 'second'] },
      { name: 'migrations generate --custom', argv: ['migrations', 'generate', '--custom', '--name', 'backfill'] },
      { name: 'dev migrate', argv: ['dev', 'migrate'] },
      { name: 'local migrate', argv: ['local', 'migrate', '--url', 'postgres://local/db'] },
      { name: 'forced pull', argv: ['pull', '--url', 'postgres://source/db', '--force'] },
    ])('runs one spinner at a time: $name', async ({ argv }) => {
      tmp.write('typebase/db/schema.ts', withPriority);

      await run(db, ...argv);

      expectNoOverlap();
    });

    it('runs one spinner at a time: migrate while the schema has drifted', async () => {
      tmp.write('typebase/db/schema.ts', withPriority);

      await run(db, 'dev', 'migrate');

      expectNoOverlap();
    });
  });

  describe('auth generate', () => {
    beforeEach(async () => {
      await generateTypebaseProject(tmp, { withAuth: false });

      tmp.write(
        'typebase/auth.ts',
        `import { defineAuth } from "typebase-io/server";\n\nexport const auth = defineAuth({ trustedOrigins: ["http://localhost:3000"], emailAndPassword: { enabled: true } });\n`
      );
    });

    it('runs one spinner at a time: push mode', async () => {
      await run(auth, 'generate');

      expectNoOverlap();
    });

    it('runs one spinner at a time: migrations mode', async () => {
      await enterMigrationsMode();

      tracker.state.overlaps = [];

      await run(auth, 'generate');

      expectNoOverlap();
    });
  });

  describe('deploy', () => {
    beforeEach(async () => {
      await generateTypebaseProject(tmp, { withAuth: false });

      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));
    });

    it('runs one spinner at a time: push mode', async () => {
      await run(deploy, 'dev', '--provider', 'vercel');

      expectNoOverlap();
    });

    it('runs one spinner at a time: migrations mode', async () => {
      await enterMigrationsMode();

      tracker.state.overlaps = [];

      await run(deploy, 'dev', '--provider', 'vercel');

      expectNoOverlap();
    });
  });

  describe('other commands', () => {
    beforeEach(async () => {
      await generateTypebaseProject(tmp, { withAuth: false });
    });

    it('runs one spinner at a time: codegen', async () => {
      await run(codegen);

      expectNoOverlap();
    });

    it('runs one spinner at a time: generate-server', async () => {
      await run(generateServer);

      expectNoOverlap();
    });

    it('runs one spinner at a time: generate-server in migrations mode', async () => {
      await enterMigrationsMode();

      tracker.state.overlaps = [];

      await run(generateServer);

      expectNoOverlap();
    });
  });

  it('notices an overlap when one actually happens', async () => {
    const { default: ora } = await import('ora');

    const outer = ora('outer').start();

    ora('inner').start().stop();
    outer.stop();

    expect(tracker.state.overlaps).toEqual(['inner']);

    expect(fs.existsSync(path.join(tmp.path, 'typebase'))).toBe(false);
  });
});
