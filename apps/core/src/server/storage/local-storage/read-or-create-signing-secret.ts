import { randomBytes } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SIGNING_SECRET_FILE_NAME = '.signing-secret';
const SIGNING_SECRET_PATTERN = /^[0-9a-f]{64}$/;

export const readOrCreateSigningSecret = (root: string): string => {
  const secretFilePath = path.join(root, SIGNING_SECRET_FILE_NAME);
  const draftFilePath = `${secretFilePath}.${process.pid}.${randomBytes(4).toString('hex')}`;

  mkdirSync(root, { recursive: true });
  writeFileSync(draftFilePath, randomBytes(32).toString('hex'), { mode: 0o600 });

  try {
    linkSync(draftFilePath, secretFilePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err;
    }
  } finally {
    rmSync(draftFilePath, { force: true });
  }

  const secret = readFileSync(secretFilePath, 'utf8');

  if (!SIGNING_SECRET_PATTERN.test(secret)) {
    throw new Error(`The local storage signing secret in \`${secretFilePath}\` is not one Typebase wrote. Delete the file and a new one is created.`);
  }

  return secret;
};
