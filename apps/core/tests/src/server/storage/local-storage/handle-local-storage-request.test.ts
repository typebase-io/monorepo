import { Files } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleLocalStorageRequest } from '#server/storage/local-storage/handle-local-storage-request.ts';

describe('handleLocalStorageRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves the request', async () => {
    const files = new Files({ adapter: memory() });

    await files.upload('me.txt', 'hello', { contentType: 'text/plain' });

    const response = await handleLocalStorageRequest({
      request: new Request('http://localhost/storage/avatars/me.txt'),
      buckets: new Map([['avatars', { files, access: 'public' as const }]]),
      basePath: '/storage',
      secret: 'secret',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('hello');
  });

  it('answers 500 without the details, logging them, when storage fails', async () => {
    const error = new Error('disk on fire');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const files = { download: () => Promise.reject(error) } as unknown as Files;

    const response = await handleLocalStorageRequest({
      request: new Request('http://localhost/storage/avatars/me.txt'),
      buckets: new Map([['avatars', { files, access: 'public' as const }]]),
      basePath: '/storage',
      secret: 'secret',
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('Storage failed');
    expect(logged).toHaveBeenCalledWith(error);
  });
});
