import { createHmac } from 'node:crypto';

export type LocalStorageSignedMethod = 'GET' | 'PUT';

export const localStorageSignature = ({
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
  const signedParams = [...params].filter(([name]) => name !== 'signature').sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return createHmac('sha256', secret)
    .update(JSON.stringify([method, bucket, key, signedParams]))
    .digest('hex');
};
