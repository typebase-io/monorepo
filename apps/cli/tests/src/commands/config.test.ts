import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '#commands/config.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const PROJECT_ROOT_PLACEHOLDER = '<project-root>';

const runConfig = async (tmp: TempDir) => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await withCwd(tmp.path, () => config.parseAsync([], { from: 'user' }));

  const output = log.mock.calls.map(([line]) => String(line)).join('\n');

  return `${output.replaceAll(tmp.path, PROJECT_ROOT_PLACEHOLDER)}\n`;
};

describe('config command', () => {
  let tmp: TempDir;

  beforeEach(() => {
    vi.clearAllMocks();
    tmp = createTempDir();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('prints the project root, the config path and the schema annotated with the defaults', async () => {
    expect(await runConfig(tmp)).toEqualTemplate('config', 'defaults.json.txt');
  });

  it('defaults `projectPath` to `src/typebase` when the project keeps sources in `src/`', async () => {
    tmp.mkdir('src');

    expect(await runConfig(tmp)).toEqualTemplate('config', 'src-directory.json.txt');
  });

  it('separates values set in the file from the ones left to defaults', async () => {
    tmp.write('typebase.json', JSON.stringify({ serverProvider: 'cloudflare', server: { adapter: 'hono', port: 9000 } }));

    expect(await runConfig(tmp)).toEqualTemplate('config', 'explicit-values.json.txt');
  });

  it('annotates options nested inside a provider', async () => {
    tmp.write('typebase.json', JSON.stringify({ neon: { orgId: 'org_9', projectId: 'proj_7' } }));

    expect(await runConfig(tmp)).toEqualTemplate('config', 'provider-values.json.txt');
  });

  it('exits with an error when `typebase.json` is malformed', async () => {
    tmp.write('typebase.json', '{ oops');

    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await withCwd(tmp.path, () => config.parseAsync([], { from: 'user' })).catch(() => undefined);

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join('\n')).toContain('is invalid');
  });
});
