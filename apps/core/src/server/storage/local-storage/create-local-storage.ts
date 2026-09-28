import path from 'node:path';

import { Files } from 'files-sdk';
import { fs } from 'files-sdk/fs';

import { type AccessBucketOptions, type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';
import { createLocalStorageBucket } from '#server/storage/local-storage/create-local-storage-bucket.ts';
import { ensureLocalStorageRoot } from '#server/storage/local-storage/ensure-local-storage-root.ts';
import { handleLocalStorageRequest } from '#server/storage/local-storage/handle-local-storage-request.ts';
import { readOrCreateSigningSecret } from '#server/storage/local-storage/read-or-create-signing-secret.ts';
import { type LocalStorageBucketEntry } from '#server/storage/local-storage/serve-local-storage-request.ts';

export interface LocalStorageOptions {
  root: string;
  url: string;
}

export interface LocalStorage {
  createBucket: (args: { name: string; bucket: AccessBucketOptions }) => PublicBucket | PrivateBucket;
  handle: (request: Request) => Promise<Response>;
}

export const createLocalStorage = ({ root: configuredRoot, url }: LocalStorageOptions): LocalStorage => {
  const root = path.resolve(configuredRoot);

  ensureLocalStorageRoot(root);

  const secret = readOrCreateSigningSecret(root);
  const baseUrl = url.replace(/\/+$/, '');
  const basePath = new URL(baseUrl, 'http://localhost').pathname.replace(/\/+$/, '');
  const buckets = new Map<string, LocalStorageBucketEntry>();

  return {
    createBucket: ({ name, bucket }) => {
      const files = new Files({ adapter: fs({ root: path.join(root, name) }), prefix: bucket.prefix, plugins: bucket.plugins, hooks: bucket.hooks });
      const { access } = bucket;

      buckets.set(name, { files, access });

      return createLocalStorageBucket({ name, files, access, baseUrl, secret });
    },
    handle: (request) => handleLocalStorageRequest({ request, buckets, basePath, secret }),
  };
};
