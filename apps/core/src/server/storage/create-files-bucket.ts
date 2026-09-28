import { type Files } from 'files-sdk';

import { BUCKET_OPERATIONS, type Bucket, type BucketAccess, type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';

export const createFilesBucket = ({ files, access }: { files: Files; access: BucketAccess }): PublicBucket | PrivateBucket => {
  const operations = Object.fromEntries(BUCKET_OPERATIONS.map((operation) => [operation, files[operation].bind(files)])) as Bucket;
  const signedUploadUrl = files.signedUploadUrl.bind(files);

  if (access === 'public') {
    return { ...operations, signedUploadUrl, publicUrl: (key) => files.url(key) };
  }

  return { ...operations, signedUploadUrl, signedUrl: (key, options) => files.url(key, options) };
};
