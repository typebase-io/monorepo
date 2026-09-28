import { type LocalStorageBucketEntry, serveLocalStorageRequest } from '#server/storage/local-storage/serve-local-storage-request.ts';

export const handleLocalStorageRequest = async (args: {
  request: Request;
  buckets: ReadonlyMap<string, LocalStorageBucketEntry>;
  basePath: string;
  secret: string;
}): Promise<Response> => {
  try {
    return await serveLocalStorageRequest(args);
  } catch (err) {
    console.error(err);

    return new Response('Storage failed', {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};
