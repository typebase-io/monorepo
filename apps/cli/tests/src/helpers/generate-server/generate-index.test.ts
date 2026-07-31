import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateIndex } from '#helpers/generate-server/generate-index.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateIndex', () => {
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

  const run = (overrides: Partial<Parameters<typeof generateIndex>[0]>) =>
    generateIndex({
      adapter: 'node',
      port: 8080,
      skipLoadEnv: true,
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      outputFilePath: path.join(tmp.path, 'out', 'index.ts'),
      actionsOutputDirPath: path.join(tmp.path, 'actions'),
      generation: 'ts',
      hasAuth: false,
      hasEnv: true,
      trustedOrigins: ['http://localhost:3000'],
      ...overrides,
    });

  it('creates the output directory and prepends dotenv for the node adapter', async () => {
    await run({ adapter: 'node', skipLoadEnv: false });

    expect(fs.statSync(path.join(tmp.path, 'out')).isDirectory()).toBe(true);
    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'node.txt');
  });

  it('omits the dotenv import for the bun adapter when env loading is skipped', async () => {
    await run({ adapter: 'bun', skipLoadEnv: true, hasAuth: true });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'bun.txt');
  });

  it('renders the cloudflare adapter', async () => {
    await run({ adapter: 'cloudflare', skipLoadEnv: true, hasAuth: true });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'cloudflare.txt');
  });

  it('renders the deno adapter', async () => {
    await run({ adapter: 'deno', skipLoadEnv: true, hasAuth: false });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'deno.txt');
  });

  it('renders the fastify adapter', async () => {
    await run({ adapter: 'fastify', skipLoadEnv: true, hasAuth: false });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'fastify.txt');
  });

  it('renders the hono adapter', async () => {
    await run({ adapter: 'hono', skipLoadEnv: true, hasAuth: true });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'hono.txt');
  });

  it('imports the env module as .js when the server is emitted as JavaScript', async () => {
    await run({ adapter: 'node', skipLoadEnv: true, generation: 'esm', outputFilePath: path.join(tmp.path, 'out', 'index.js') });

    expect(tmp.read('out/index.js')).toEqualTemplate('generate-index', 'node-js-env.txt');
  });

  it('imports no env module when the project has none', async () => {
    await run({ adapter: 'node', skipLoadEnv: true, hasEnv: false });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-index', 'node-no-env.txt');
  });
});
