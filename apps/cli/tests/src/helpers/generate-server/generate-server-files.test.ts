import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { generateServerFiles } from '#helpers/generate-server/generate-server-files.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateServerFiles', () => {
  let tmp: TempDir;

  const TS_CONFIG = JSON.stringify({
    compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
    include: ['./**/*.ts'],
  });

  beforeEach(() => {
    tmp = createTempDir();
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.mkdir('actions');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = (overrides: Partial<Parameters<typeof generateServerFiles>[0]>) =>
    generateServerFiles({
      adapter: 'node',
      mode: 'standalone',
      port: 8080,
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      outputDirPath: path.join(tmp.path, 'out'),
      actionsOutputDirPath: path.join(tmp.path, 'actions'),
      generation: 'ts',
      hasAuth: false,
      hasEnv: true,
      trustedOrigins: ['http://localhost:3000'],
      actionsPath: DEFAULT_ACTIONS_PATH,
      authPath: DEFAULT_AUTH_PATH,
      ...overrides,
    });

  const expectOutcome = (outcome: string) => {
    expect(tmp.read('out/server.ts')).toEqualTemplate('generate-server-files', outcome, 'server.ts.txt');
    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-server-files', outcome, 'index.ts.txt');
  };

  it('creates the output directory and prepends dotenv for the node adapter', async () => {
    await run({ adapter: 'node' });

    expect(fs.statSync(path.join(tmp.path, 'out')).isDirectory()).toBe(true);
    expectOutcome('node');
  });

  it('emits only the construction unit for an embedded node server, with no cross-origin handling', async () => {
    await run({ adapter: 'node', mode: 'embedded' });

    expect(tmp.read('out/server.ts')).toEqualTemplate('generate-server-files', 'node-embedded', 'server.ts.txt');
    expect(tmp.exists('out/index.ts')).toBe(false);
  });

  it('renders the bun adapter', async () => {
    await run({ adapter: 'bun', hasAuth: true });

    expectOutcome('bun');
  });

  it('renders the cloudflare adapter without dotenv, because it reads its bindings instead', async () => {
    await run({ adapter: 'cloudflare', hasAuth: true });

    expectOutcome('cloudflare');
  });

  it('renders the deno adapter', async () => {
    await run({ adapter: 'deno', hasAuth: false });

    expectOutcome('deno');
  });

  it('renders the fastify adapter', async () => {
    await run({ adapter: 'fastify', hasAuth: false });

    expectOutcome('fastify');
  });

  it('renders the hono adapter', async () => {
    await run({ adapter: 'hono', hasAuth: true });

    expectOutcome('hono');
  });

  it('imports the env module as .js when the server is emitted as JavaScript', async () => {
    await run({ adapter: 'node', generation: 'esm' });

    expectOutcome('node-js-env');
  });

  it('imports neither the env module nor dotenv when the project has no env', async () => {
    await run({ adapter: 'node', hasEnv: false });

    expectOutcome('node-no-env');
  });
});
