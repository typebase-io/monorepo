import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listenUntilClosed } from '#helpers/logs/cloudflare/listen-until-closed.ts';
import { printMessage } from '#helpers/logs/cloudflare/print-message.ts';

vi.mock('#helpers/logs/cloudflare/print-message.ts', () => ({ printMessage: vi.fn() }));

class FakeWebSocket {
  public static instances: FakeWebSocket[] = [];

  public url: string;
  public protocol: string;
  public binaryType = 'blob';
  public sent: string[] = [];
  public closeCalls = 0;

  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  public constructor(url: string, protocol: string) {
    this.url = url;
    this.protocol = protocol;

    FakeWebSocket.instances.push(this);
  }

  public addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(): void {
    this.closeCalls++;
    this.emit('close', {});
  }

  public emit(type: string, event: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const socket = () => {
  const instance = FakeWebSocket.instances[0];

  if (!instance) {
    throw new Error('No socket was opened.');
  }

  return instance;
};

describe('listenUntilClosed', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    FakeWebSocket.instances = [];

    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('connects with the trace-v1 protocol and reads binary frames', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    expect(socket().url).toBe('wss://tail.example.com/tail-1');
    expect(socket().protocol).toBe('trace-v1');
    expect(socket().binaryType).toBe('arraybuffer');

    socket().close();
    await promise;
  });

  it('sends the filter payload once the socket opens', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    expect(socket().sent).toEqual([]);

    socket().emit('open', {});

    expect(socket().sent).toEqual([JSON.stringify({ debug: false })]);

    socket().close();
    await promise;
  });

  it('forwards text and binary frames to the printer', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    const binary = new TextEncoder().encode('{"outcome":"ok"}').buffer;

    socket().emit('message', { data: '{"outcome":"ok"}' });
    socket().emit('message', { data: binary });

    expect(printMessage).toHaveBeenNthCalledWith(1, '{"outcome":"ok"}');
    expect(printMessage).toHaveBeenNthCalledWith(2, binary);

    socket().close();
    await promise;
  });

  it('resolves when the server closes the socket', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    socket().emit('close', {});

    await expect(promise).resolves.toBeUndefined();
  });

  it('closes the socket and resolves when the signal aborts', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    abort.abort();

    await expect(promise).resolves.toBeUndefined();
    expect(socket().closeCalls).toBe(1);
  });

  it('rejects when the connection fails', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    socket().emit('error', {});

    await expect(promise).rejects.toThrow('The Cloudflare tail connection failed.');
  });

  it('ignores the error the socket raises while shutting down after an abort', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    abort.abort();
    socket().emit('error', {});

    await expect(promise).resolves.toBeUndefined();
  });

  it('stops listening for aborts once the socket has closed', async () => {
    const abort = new AbortController();
    const promise = listenUntilClosed({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    socket().emit('close', {});
    await promise;

    abort.abort();

    expect(socket().closeCalls).toBe(0);
  });
});
