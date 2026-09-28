import { type Files } from 'files-sdk';

import { BUCKET_OPERATIONS, type Bucket, type BucketAccess, type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';
import { localStorageObjectUrl } from '#server/storage/local-storage/local-storage-object-url.ts';
import { signLocalStorageUrl } from '#server/storage/local-storage/sign-local-storage-url.ts';

const DEFAULT_SIGNED_URL_EXPIRES_IN = 3600;

export const createLocalStorageBucket = ({
  name,
  files,
  access,
  baseUrl,
  secret,
}: {
  name: string;
  files: Files;
  access: BucketAccess;
  baseUrl: string;
  secret: string;
}): PublicBucket | PrivateBucket => {
  const operations = Object.fromEntries(BUCKET_OPERATIONS.map((operation) => [operation, files[operation].bind(files)])) as Bucket;

  const signedUploadUrl: PublicBucket['signedUploadUrl'] = (key, { expiresIn, contentType, maxSize, minSize }) =>
    new Promise((resolve) => {
      const url = signLocalStorageUrl({
        secret,
        baseUrl,
        method: 'PUT',
        bucket: name,
        key,
        expiresIn,
        params: {
          'content-type': contentType,
          'max-size': maxSize === undefined ? undefined : String(maxSize),
          'min-size': maxSize === undefined ? undefined : String(minSize ?? 1),
        },
      });

      resolve(contentType === undefined ? { method: 'PUT', url } : { method: 'PUT', url, headers: { 'Content-Type': contentType } });
    });

  if (access === 'public') {
    return { ...operations, signedUploadUrl, publicUrl: (key) => Promise.resolve(localStorageObjectUrl(baseUrl, name, key)) };
  }

  return {
    ...operations,
    signedUploadUrl,
    signedUrl: (key, options) =>
      new Promise((resolve) => {
        resolve(
          signLocalStorageUrl({
            secret,
            baseUrl,
            method: 'GET',
            bucket: name,
            key,
            expiresIn: options?.expiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_IN,
            params: { disposition: options?.responseContentDisposition },
          })
        );
      }),
  };
};
