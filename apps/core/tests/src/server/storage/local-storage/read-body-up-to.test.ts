import { describe, expect, it } from 'vitest';

import { readBodyUpTo } from '#server/storage/local-storage/read-body-up-to.ts';

describe('readBodyUpTo', () => {
  const streamed = (chunks: string[]) => {
    let pulled = 0;
    let cancelled = false;

    const body = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        const chunk = chunks[pulled];

        pulled += 1;

        if (chunk === undefined) {
          controller.close();
        } else {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      },
      cancel: () => {
        cancelled = true;
      },
    });

    const request = new Request('http://localhost/', { method: 'PUT', body, duplex: 'half' } as RequestInit);

    return { request, pulled: () => pulled, cancelled: () => cancelled };
  };

  const text = (body: Uint8Array | undefined) => (body === undefined ? undefined : new TextDecoder().decode(body));

  it('joins every chunk of the body', async () => {
    expect(text(await readBodyUpTo(streamed(['hel', 'lo', ' world']).request, undefined))).toBe('hello world');
  });

  it('reads a body exactly at the limit', async () => {
    expect(text(await readBodyUpTo(streamed(['hello']).request, 5))).toBe('hello');
  });

  it('stops reading and cancels the body as soon as it passes the limit', async () => {
    const body = streamed(['hello', ' world', ' and more']);

    expect(await readBodyUpTo(body.request, 7)).toBeUndefined();
    expect(body.pulled()).toBe(2);
    expect(body.cancelled()).toBe(true);
  });

  it('reads a request without a body as empty', async () => {
    expect(await readBodyUpTo(new Request('http://localhost/'), 10)).toEqual(new Uint8Array());
  });
});
