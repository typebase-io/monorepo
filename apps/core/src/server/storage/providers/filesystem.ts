import { tmpdir } from 'node:os';
import path from 'node:path';

import { type Adapter, Files } from 'files-sdk';
import { fs } from 'files-sdk/fs';

import { type Bucket, type FilesBucketOptions } from '#server/storage/bucket.ts';

export interface FilesystemStorageOptions {
  root?: string;
}

export interface FilesystemBucketOptions extends FilesBucketOptions {
  access?: never;
}

export interface FilesystemStorageResources {
  adapter?: (bucketName: string) => Adapter;
}

export const createFilesystemBucket = ({
  name,
  bucket,
  options,
  resources,
}: {
  name: string;
  bucket: FilesystemBucketOptions;
  options: FilesystemStorageOptions | undefined;
  resources: FilesystemStorageResources;
}): Bucket => {
  const adapter = resources.adapter?.(name) ?? fs({ root: path.join(options?.root ?? path.join(tmpdir(), 'typebase-storage'), name) });

  return new Files({ adapter, prefix: bucket.prefix, plugins: bucket.plugins, hooks: bucket.hooks });
};
