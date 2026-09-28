import type * as fs from 'node:fs';
import { linkSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readOrCreateSigningSecret } from '#server/storage/local-storage/read-or-create-signing-secret.ts';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();

  return { ...actual, linkSync: vi.fn(actual.linkSync) };
});

describe('readOrCreateSigningSecret', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'typebase-signing-secret-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('creates a random 256-bit hex secret only the owner can read, and leaves no draft behind', () => {
    const secret = readOrCreateSigningSecret(root);

    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(path.join(root, '.signing-secret'), 'utf8')).toBe(secret);
    expect(readdirSync(root)).toEqual(['.signing-secret']);
    expect(statSync(path.join(root, '.signing-secret')).mode & 0o777).toBe(0o600);
  });

  it('reads the secret an earlier run created instead of replacing it', () => {
    const first = readOrCreateSigningSecret(root);

    expect(readOrCreateSigningSecret(root)).toBe(first);
  });

  it('gives each root its own secret', () => {
    const other = mkdtempSync(path.join(tmpdir(), 'typebase-signing-secret-test-'));

    try {
      expect(readOrCreateSigningSecret(other)).not.toBe(readOrCreateSigningSecret(root));
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('creates the root when it does not exist yet', () => {
    expect(readOrCreateSigningSecret(path.join(root, 'nested'))).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(['', 'short', 'A'.repeat(64), `${'a'.repeat(64)}\n`])('refuses a secret file holding %j, naming it', (contents) => {
    writeFileSync(path.join(root, '.signing-secret'), contents);

    expect(() => readOrCreateSigningSecret(root)).toThrow(
      `The local storage signing secret in \`${path.join(root, '.signing-secret')}\` is not one Typebase wrote. Delete the file and a new one is created.`
    );
  });

  it('fails when the secret cannot be put in place for a reason other than an earlier run, leaving no draft behind', () => {
    const error = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });

    vi.mocked(linkSync).mockImplementationOnce(() => {
      throw error;
    });

    expect(() => readOrCreateSigningSecret(root)).toThrow(error);
    expect(readdirSync(root)).toEqual([]);
  });
});
