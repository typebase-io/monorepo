import { timingSafeEqual } from 'node:crypto';

import { type LocalStorageSignedMethod, localStorageSignature } from '#server/storage/local-storage/local-storage-signature.ts';

export const hasValidLocalStorageSignature = ({
  secret,
  method,
  bucket,
  key,
  params,
}: {
  secret: string;
  method: LocalStorageSignedMethod;
  bucket: string;
  key: string;
  params: URLSearchParams;
}) => {
  const signature = params.get('signature');
  const expires = Number(params.get('expires'));

  if (!signature || !Number.isInteger(expires) || expires * 1000 < Date.now()) {
    return false;
  }

  const expected = Buffer.from(localStorageSignature({ secret, method, bucket, key, params }), 'hex');
  const actual = Buffer.from(signature, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
