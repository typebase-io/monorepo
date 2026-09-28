import { localStorageObjectUrl } from '#server/storage/local-storage/local-storage-object-url.ts';
import { type LocalStorageSignedMethod, localStorageSignature } from '#server/storage/local-storage/local-storage-signature.ts';

export const signLocalStorageUrl = ({
  secret,
  baseUrl,
  method,
  bucket,
  key,
  expiresIn,
  params = {},
}: {
  secret: string;
  baseUrl: string;
  method: LocalStorageSignedMethod;
  bucket: string;
  key: string;
  expiresIn: number;
  params?: Record<string, string | undefined>;
}) => {
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error(`A signed URL needs a positive, finite \`expiresIn\` in seconds, not ${expiresIn}.`);
  }

  const searchParams = new URLSearchParams({ expires: String(Math.ceil(Date.now() / 1000 + expiresIn)) });

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(name, value);
    }
  }

  searchParams.set('signature', localStorageSignature({ secret, method, bucket, key, params: searchParams }));

  return `${localStorageObjectUrl(baseUrl, bucket, key)}?${searchParams.toString()}`;
};
