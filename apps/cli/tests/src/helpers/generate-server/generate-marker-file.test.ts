import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVER_MARKER_FILE_NAME, serverMarkerSchema } from '#helpers/constants.ts';
import { generateMarkerFile } from '#helpers/generate-server/generate-marker-file.ts';
import { getCliVersion } from '#helpers/shared/get-cli-version.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/get-cli-version.ts', () => ({ getCliVersion: vi.fn() }));

describe('generateMarkerFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
    vi.mocked(getCliVersion).mockReturnValue('1.2.3');
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  const run = (overrides: Partial<Parameters<typeof generateMarkerFile>[0]> = {}) =>
    generateMarkerFile({
      outputDirPath: tmp.path,
      adapter: 'node',
      mode: 'standalone',
      dependencies: { 'drizzle-orm': '1.0.0', 'typebase-io': '0.1.0' },
      devDependencies: { typescript: '5.9.3' },
      envKeys: ['DATABASE_URL', 'BETTER_AUTH_SECRET'],
      ...overrides,
    });

  const readMarker = () => serverMarkerSchema.parse(JSON.parse(tmp.read(SERVER_MARKER_FILE_NAME)) as unknown);

  it('records what produced the directory, what it needs, and what it reads', async () => {
    await run();

    expect(tmp.read(SERVER_MARKER_FILE_NAME)).toEqualTemplate('generate-marker-file', 'node-standalone.txt');
  });

  it('writes a marker the directory guard recognises', async () => {
    await run();

    expect(serverMarkerSchema.safeParse(readMarker()).success).toBe(true);
  });

  it('records the adapter and mode it was given', async () => {
    await run({ adapter: 'fastify', mode: 'embedded' });

    expect(tmp.read(SERVER_MARKER_FILE_NAME)).toEqualTemplate('generate-marker-file', 'fastify-embedded.txt');
  });

  it('records an unknown CLI version rather than omitting the field, so the marker still parses', async () => {
    vi.mocked(getCliVersion).mockReturnValue(undefined);

    await run();

    expect(tmp.read(SERVER_MARKER_FILE_NAME)).toEqualTemplate('generate-marker-file', 'unknown-version.txt');
    expect(serverMarkerSchema.safeParse(readMarker()).success).toBe(true);
  });

  it('creates the output directory when it does not exist yet', async () => {
    await run({ outputDirPath: `${tmp.path}/nested/out` });

    expect(tmp.exists(`nested/out/${SERVER_MARKER_FILE_NAME}`)).toBe(true);
  });

  it('writes it as formatted JSON a person can read', async () => {
    await run();

    expect(tmp.read(SERVER_MARKER_FILE_NAME)).toEqualTemplate('generate-marker-file', 'node-standalone.txt');
  });
});
