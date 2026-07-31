import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type EnvTarget, type ServerAdapter } from '#helpers/constants.ts';
import { generateEnvFile } from '#helpers/generate-server/generate-env-file.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

interface Options {
  adapter?: ServerAdapter;
  hasDB?: boolean;
  hasAuth?: boolean;
  useTs?: boolean;
  target?: EnvTarget;
}

describe('generateEnvFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = ({ adapter = 'node', hasDB = true, hasAuth = false, useTs = true, target }: Options = {}) =>
    generateEnvFile({
      envFilePath: path.join(tmp.path, 'env.ts'),
      envOutputDirPath: path.join(tmp.path, 'out'),
      adapter,
      hasDB,
      hasAuth,
      useTs,
      target,
    });

  const runWithSchema = (source: string, options: Options = {}) => {
    tmp.write('env.ts', source);

    return run(options);
  };

  it('creates the output directory even when it does not exist yet', async () => {
    const envOutputDirPath = path.join(tmp.path, 'does', 'not', 'exist');

    await generateEnvFile({
      envFilePath: path.join(tmp.path, 'env.ts'),
      envOutputDirPath,
      adapter: 'node',
      hasDB: true,
      hasAuth: false,
      useTs: true,
      target: undefined,
    });

    expect(fs.statSync(envOutputDirPath).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(envOutputDirPath, 'env.ts'), 'utf8')).toEqualTemplate('generate-env-file', 'db-only.txt');
  });

  it('injects DATABASE_URL for a project with a database schema', async () => {
    await run({ hasDB: true, hasAuth: false });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'db-only.txt');
  });

  it('injects BETTER_AUTH_SECRET for a project with auth', async () => {
    await run({ hasDB: false, hasAuth: true });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'auth-only.txt');
  });

  it('injects both when the project has a database schema and auth', async () => {
    await run({ hasDB: true, hasAuth: true });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'db-auth.txt');
  });

  it('generates an env module with nothing injected when the project has neither', async () => {
    await run({ hasDB: false, hasAuth: false });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'bare.txt');
  });

  it('reads the carrier from cloudflare:workers under an alias on the cloudflare adapter', async () => {
    await run({ adapter: 'cloudflare', hasDB: true, hasAuth: true });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'cloudflare.txt');
  });

  it('reads the carrier from cloudflare:workers even when nothing is injected', async () => {
    await run({ adapter: 'cloudflare', hasDB: false, hasAuth: false });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'cloudflare-bare.txt');
  });

  it.each<ServerAdapter>(['node', 'bun', 'deno', 'fastify', 'hono'])('reads the carrier from process.env on the %s adapter', async (adapter) => {
    await run({ adapter });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'db-only.txt');
  });

  it('names the generated module env.ts even when the server is emitted as JavaScript', async () => {
    await run({ useTs: false });

    expect(tmp.exists('out/env.js')).toBe(false);
    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'db-only.txt');
  });

  it('leaves the env file the project wrote untouched', async () => {
    const schema = `
      import { defineEnv } from "typebase-io/server";
      import { z } from "zod";

      export const env = defineEnv({
        STRIPE_SECRET_KEY: z.string().min(1),
      });
    `;

    await runWithSchema(removeExtraSpaces(schema));

    expect(tmp.read('env.ts')).toBe(removeExtraSpaces(schema));
  });

  it.each<EnvTarget>(['dev', 'prod'])('names the %s Target in the boot failure message when it is known', async (target) => {
    await run({ target });

    expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', `target-${target}.txt`);
  });

  describe('when the project declares an Env Schema', () => {
    it('rewrites defineEnv to createEnv and keeps the declared variables', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({
          STRIPE_SECRET_KEY: z.string().min(1),
        });
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-zod.txt');
    });

    it('preserves the validation library the project chose', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import * as v from "valibot";

        export const env = defineEnv({
          STRIPE_SECRET_KEY: v.pipe(v.string(), v.minLength(1)),
        });
      `;

      await runWithSchema(removeExtraSpaces(schema), { hasDB: true, hasAuth: true });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-valibot.txt');
    });

    it('drops the scoped @typebase-io/typebase import as well', async () => {
      const schema = `
        import { defineEnv } from "@typebase-io/typebase/server";
        import { z } from "zod";

        export const env = defineEnv({ STRIPE_SECRET_KEY: z.string() });
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-scoped-import.txt');
    });

    it('carries over the imports the declared schema depends on', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        import { stripeKey } from "./validators.ts";

        export const env = defineEnv({ STRIPE_SECRET_KEY: stripeKey, SENTRY_DSN: z.string().url() });
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-extra-imports.txt');
    });

    it('carries over no imports when the declared Env Schema is empty', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({});
      `;

      await runWithSchema(removeExtraSpaces(schema), { hasDB: true, hasAuth: false });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'db-only.txt');
    });

    it('lets a declared key win over the one Typebase would inject', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({
          DATABASE_URL: z.string().startsWith("postgres://"),
        });
      `;

      await runWithSchema(removeExtraSpaces(schema), { hasDB: true, hasAuth: false });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-declared-key.txt');
    });

    it('still injects the other keys when one is declared', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({
          DATABASE_URL: z.string().startsWith("postgres://"),
        });
      `;

      await runWithSchema(removeExtraSpaces(schema), { hasDB: true, hasAuth: true });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-declared-key-with-auth.txt');
    });

    it('lists the injected keys before the declared ones', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({
          STRIPE_SECRET_KEY: z.string().min(1),
        });
      `;

      await runWithSchema(removeExtraSpaces(schema), { hasDB: true, hasAuth: true });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-zod-db-auth.txt');
    });

    it('spreads the second argument options into the generated module', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv(
          { STRIPE_SECRET_KEY: z.string() },
          { emptyStringAsUndefined: false, skipValidation: process.env.SKIP_ENV_VALIDATION === "true" }
        );
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-options.txt');
    });

    it('lets a declared carrier win over the one the adapter would use', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({ STRIPE_SECRET_KEY: z.string() }, { runtimeEnv: Deno.env.toObject() });
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-runtime-env-option.txt');
    });

    it('resolves the options passed as a local variable', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        const options = { skipValidation: true };

        export const env = defineEnv({ STRIPE_SECRET_KEY: z.string() }, options);
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-options-variable.txt');
    });

    it('ignores options that are not plain assignments', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        const shared = { skipValidation: true };

        export const env = defineEnv({ STRIPE_SECRET_KEY: z.string() }, { ...shared });
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-options-spread.txt');
    });

    it('aliases the cloudflare carrier alongside a declared schema', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({
          STRIPE_SECRET_KEY: z.string().min(1),
        });
      `;

      await runWithSchema(removeExtraSpaces(schema), { adapter: 'cloudflare' });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-cloudflare.txt');
    });

    it('resolves a schema passed as a local variable', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        const schema = { STRIPE_SECRET_KEY: z.string() };

        export const env = defineEnv(schema);
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-variable.txt');
    });

    it('resolves a schema behind a satisfies expression', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({ STRIPE_SECRET_KEY: z.string() } satisfies Record<string, z.ZodType>);
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-satisfies.txt');
    });

    it('reads the first defineEnv call when the file has more than one', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { z } from "zod";

        export const env = defineEnv({ STRIPE_SECRET_KEY: z.string() });
        export const other = defineEnv({ RESEND_API_KEY: z.string() });
      `;

      await runWithSchema(removeExtraSpaces(schema));

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-multiple-calls.txt');
    });

    it('rewrites extensionless relative imports to .js when the server is emitted as JavaScript', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { stripeKey } from "./validators";

        export const env = defineEnv({ STRIPE_SECRET_KEY: stripeKey });
      `;

      await runWithSchema(removeExtraSpaces(schema), { useTs: false });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-js-imports.txt');
    });

    it('rewrites extensionless relative imports to .ts when the server is emitted as TypeScript', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";
        import { stripeKey } from "./validators";

        export const env = defineEnv({ STRIPE_SECRET_KEY: stripeKey });
      `;

      await runWithSchema(removeExtraSpaces(schema), { useTs: true });

      expect(tmp.read('out/env.ts')).toEqualTemplate('generate-env-file', 'schema-ts-imports.txt');
    });

    it('throws when defineEnv is given something it cannot resolve', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";

        export const env = defineEnv(getSchema());
      `;

      await expect(runWithSchema(removeExtraSpaces(schema))).rejects.toThrow('`defineEnv` must be called with an inline object literal');
    });

    it('throws when the referenced variable does not hold an object literal', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";

        const schema = makeSchema();

        export const env = defineEnv(schema);
      `;

      await expect(runWithSchema(removeExtraSpaces(schema))).rejects.toThrow('`defineEnv` must be called with an inline object literal');
    });

    it('throws when the file has no defineEnv call', async () => {
      const schema = `
        export const env = { STRIPE_SECRET_KEY: "hard-coded" };
      `;

      await expect(runWithSchema(removeExtraSpaces(schema))).rejects.toThrow('no `defineEnv` call was found');
    });

    it('names the env file it could not read in the failure', async () => {
      const schema = `
        export const env = { STRIPE_SECRET_KEY: "hard-coded" };
      `;

      await expect(runWithSchema(removeExtraSpaces(schema))).rejects.toThrow(path.join(tmp.path, 'env.ts'));
    });

    it('writes no output file when the declared Env Schema cannot be read', async () => {
      const schema = `
        import { defineEnv } from "typebase-io/server";

        export const env = defineEnv(getSchema());
      `;

      await expect(runWithSchema(removeExtraSpaces(schema))).rejects.toThrow();

      expect(tmp.exists('out/env.ts')).toBe(false);
    });
  });
});
