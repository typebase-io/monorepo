import fs from 'node:fs';
import path from 'node:path';

import * as AuthAPI from 'auth/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateAuthSchema } from '#helpers/auth/generate-auth-schema.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('auth/api', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthAPI>();

  return {
    ...actual,
    generateDrizzleSchema: vi.fn(actual.generateDrizzleSchema),
  };
});

const mockedGenerateDrizzleSchema = vi.mocked(AuthAPI.generateDrizzleSchema);

describe('generateAuthSchema', () => {
  let tmp: TempDir;
  let auth: string;
  let schema: string;
  let relations: string;

  beforeEach(() => {
    tmp = createTempDir();

    auth = `
      export const auth = { options: { emailAndPassword: { enabled: true } } };
    `;

    schema = `
      import { p } from "typebase-io/db";

      export const todosTable = p.pgTable("todos", {
        id: p.text("id").primaryKey(),
      });
    `;

    relations = `
      import { q } from "typebase-io/db";

      import * as schema from "./schema.ts";

      export const relations = q.defineRelations(schema, (r) => ({
        todos: {},
      }));
    `;
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  const run = () => {
    tmp.write('auth.ts', removeExtraSpaces(auth));
    tmp.write('schema.ts', removeExtraSpaces(schema));
    tmp.write('relations.ts', removeExtraSpaces(relations));

    return generateAuthSchema({
      schemaFilePath: path.join(tmp.path, 'schema.ts'),
      relationsFilePath: path.join(tmp.path, 'relations.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
    });
  };

  it('writes the generated auth schema and relations while preserving existing tables', async () => {
    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations.txt');
  });

  it('throws when Better Auth does not return generated schema code', async () => {
    mockedGenerateDrizzleSchema.mockResolvedValueOnce({
      code: undefined,
      fileName: '',
    });

    await expect(run()).rejects.toThrow('Better Auth did not return generated schema code.');
  });

  it('writes generated auth schema and relations for plugin tables', async () => {
    fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(tmp.path, 'node_modules'), 'dir');

    auth = `
      import { twoFactor } from "better-auth/plugins";

      const defineAuth = (options: Record<string, unknown>) => ({ options });

      export const auth = defineAuth({
        emailAndPassword: { enabled: true },
        plugins: [twoFactor()],
      });
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema-with-two-factor-plugin.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations-with-two-factor-plugin.txt');
  });

  it('preserves non-auth relation entries and replaces stale auth relation entries', async () => {
    relations = `
      import { q } from "typebase-io/db";

      import * as schema from "./schema.ts";

      const extra = {};

      export const relations = q.defineRelations(schema, (r) => ({
        todos: { ownerId: "kept" },
        ...extra,
        sessions: { stale: true },
        users: { stale: true },
      }));
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations-existing-entries.txt');
  });

  it('replaces a stale auth table declaration instead of duplicating it', async () => {
    schema = `
      import { p } from "typebase-io/db";

      export const todosTable = p.pgTable("todos", {
        id: p.text("id").primaryKey(),
      });

      export const users = p.pgTable("users", {
        id: p.text("id").primaryKey(),
      });
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations.txt');
  });

  it('removes stale auth table declarations without dropping sibling declarations', async () => {
    schema = `
      import { p } from "typebase-io/db";

      export const todosTable = p.pgTable("todos", {
        id: p.text("id").primaryKey(),
      }), users = p.pgTable("users", {
        id: p.text("id").primaryKey(),
      });
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations.txt');
  });

  it('skips unrelated calls and still merges the q.defineRelations call', async () => {
    relations = `
      import { q } from "typebase-io/db";

      import * as schema from "./schema.ts";

      noop();

      export const relations = q.defineRelations(schema, (r) => ({
        todos: {},
      }));
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations-other-call.txt');
  });

  it('leaves relations unchanged when defineRelations callback is not an inline arrow function', async () => {
    relations = `
      import { q } from "typebase-io/db";

      import * as schema from "./schema.ts";

      const callback = (r) => ({ todos: {} });

      export const relations = q.defineRelations(schema, callback);
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations-non-arrow-callback.txt');
  });

  it('leaves relations unchanged when defineRelations callback body is not an object literal', async () => {
    relations = `
      import { q } from "typebase-io/db";

      import * as schema from "./schema.ts";

      const config = { todos: {} };

      export const relations = q.defineRelations(schema, (r) => config);
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations-non-object-callback.txt');
  });

  it('leaves relations unchanged when there is no q.defineRelations call', async () => {
    relations = `
      import { q } from "typebase-io/db";

      import * as schema from "./schema.ts";

      export const relations = {};
    `;

    await run();

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-auth-schema', 'schema.txt');
    expect(tmp.read('relations.ts')).toEqualTemplate('generate-auth-schema', 'relations-no-define-relations.txt');
  });
});
