import { type Files, FilesError, type StoredFile } from 'files-sdk';

import { type BucketAccess } from '#server/storage/bucket.ts';
import { hasValidLocalStorageSignature } from '#server/storage/local-storage/has-valid-local-storage-signature.ts';
import { isActiveContentType } from '#server/storage/local-storage/is-active-content-type.ts';
import { mediaType } from '#server/storage/local-storage/media-type.ts';
import { parseLocalStoragePath } from '#server/storage/local-storage/parse-local-storage-path.ts';
import { readBodyUpTo } from '#server/storage/local-storage/read-body-up-to.ts';

export interface LocalStorageBucketEntry {
  files: Files;
  access: BucketAccess;
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

export const serveLocalStorageRequest = async ({
  request,
  buckets,
  basePath,
  secret,
}: {
  request: Request;
  buckets: ReadonlyMap<string, LocalStorageBucketEntry>;
  basePath: string;
  secret: string;
}): Promise<Response> => {
  const reply = (status: number, message: string, headers: Record<string, string> = {}) =>
    new Response(message, { status, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...headers } });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Methods': 'GET, HEAD, PUT',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      },
    });
  }

  const url = new URL(request.url);
  const path = parseLocalStoragePath(url.pathname, basePath);

  if (path === 'not-found') {
    return reply(404, 'Not found');
  }

  if (path === 'bad-key') {
    return reply(400, 'Invalid file key');
  }

  const entry = buckets.get(path.bucket);

  if (!entry) {
    return reply(404, 'Not found');
  }

  const { bucket, key } = path;
  const params = url.searchParams;

  if (request.method === 'GET' || request.method === 'HEAD') {
    const signed = hasValidLocalStorageSignature({ secret, method: 'GET', bucket, key, params });

    if (entry.access === 'private' && !signed) {
      return reply(403, 'Missing, invalid or expired signature');
    }

    let file: StoredFile;

    try {
      file = request.method === 'HEAD' ? await entry.files.head(key) : await entry.files.download(key);
    } catch (err) {
      if (err instanceof FilesError && err.code === 'NotFound') {
        return reply(404, 'Not found');
      }

      throw err;
    }

    const disposition = signed ? params.get('disposition') : null;
    const contentType = file.type || 'application/octet-stream';

    return new Response(request.method === 'HEAD' ? null : file.stream(), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(file.size),
        'X-Content-Type-Options': 'nosniff',
        ...(isActiveContentType(contentType) ? { 'Content-Security-Policy': 'sandbox' } : {}),
        ...(disposition === null ? {} : { 'Content-Disposition': disposition }),
      },
    });
  }

  if (request.method === 'PUT') {
    if (!hasValidLocalStorageSignature({ secret, method: 'PUT', bucket, key, params })) {
      return reply(403, 'Missing, invalid or expired signature');
    }

    const signedContentType = params.get('content-type');
    const sentContentType = request.headers.get('content-type');

    if (signedContentType !== null && mediaType(sentContentType) !== mediaType(signedContentType)) {
      return reply(403, `This upload URL only accepts ${signedContentType}`);
    }

    const maxSize = params.get('max-size');
    const body = await readBodyUpTo(request, maxSize === null ? undefined : Number(maxSize));

    if (body === undefined) {
      return reply(413, `This upload URL accepts at most ${maxSize} bytes`);
    }

    if (maxSize !== null && body.byteLength < Number(params.get('min-size'))) {
      return reply(400, `This upload URL needs at least ${params.get('min-size')} bytes`);
    }

    await entry.files.upload(key, body, { contentType: sentContentType ?? signedContentType ?? undefined });

    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  return reply(405, 'Method not allowed', { Allow: 'GET, HEAD, PUT, OPTIONS' });
};
