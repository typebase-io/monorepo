import { type AnyRouter } from '@orpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createORPCClient = vi.hoisted(() => vi.fn((link: unknown) => ({ link })));
const createTanstackQueryUtils = vi.hoisted(() => vi.fn((client: unknown, options: unknown) => ({ client, options })));
const RPCLink = vi.hoisted(() => vi.fn());
const consumeEventIterator = vi.hoisted(() => vi.fn());

vi.mock('@orpc/client', () => ({ createORPCClient, consumeEventIterator }));
vi.mock('@orpc/client/fetch', () => ({ RPCLink }));
vi.mock('@orpc/tanstack-query', () => ({ createTanstackQueryUtils }));

const { consumeStream, createRouterClient, createTanstackQueryClient } = await import('#client/router-client.ts');

const linkOptionsAt = (index: number) => vi.mocked(RPCLink).mock.calls[index]?.[0] as { url?: unknown; headers?: unknown };

const linkOptions = () => linkOptionsAt(0);

describe('createRouterClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends the rpc path to a string url', () => {
    createRouterClient<AnyRouter>({ url: 'https://api.example.com' });

    expect(linkOptions().url).toBe('https://api.example.com/rpc');
  });

  it('normalises a trailing slash before appending the rpc path', () => {
    createRouterClient<AnyRouter>({ url: 'https://api.example.com/base/' });

    expect(linkOptions().url).toBe('https://api.example.com/base/rpc');
  });

  it('normalises repeated trailing slashes', () => {
    createRouterClient<AnyRouter>({ url: 'https://api.example.com///' });

    expect(linkOptions().url).toBe('https://api.example.com/rpc');
  });

  it('does not mutate the options it was given', () => {
    const options = { url: 'https://api.example.com' };

    createRouterClient<AnyRouter>(options);

    expect(options.url).toBe('https://api.example.com');
  });

  it('appends the rpc path once when the same options are reused', () => {
    const options = { url: 'https://api.example.com' };

    createRouterClient<AnyRouter>(options);
    createRouterClient<AnyRouter>(options);

    expect(linkOptionsAt(0).url).toBe('https://api.example.com/rpc');
    expect(linkOptionsAt(1).url).toBe('https://api.example.com/rpc');
  });

  it('leaves a non-string url alone', () => {
    const url = new URL('https://api.example.com/rpc');

    createRouterClient<AnyRouter>({ url });

    expect(linkOptions().url).toBe(url);
  });

  it('forwards the remaining link options', () => {
    const headers = { authorization: 'Bearer token' };

    createRouterClient<AnyRouter>({ url: 'https://api.example.com', headers });

    expect(linkOptions().headers).toBe(headers);
  });

  it('returns the client built from the link', () => {
    const client = createRouterClient<AnyRouter>({ url: 'https://api.example.com' });

    expect(createORPCClient).toHaveBeenCalledTimes(1);
    expect(client).toBe(createORPCClient.mock.results[0]?.value);
    expect(createORPCClient).toHaveBeenCalledWith(vi.mocked(RPCLink).mock.instances[0]);
  });
});

describe('createTanstackQueryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends the rpc path to a string url', () => {
    createTanstackQueryClient<AnyRouter>({ url: 'https://api.example.com' });

    expect(linkOptions().url).toBe('https://api.example.com/rpc');
  });

  it('wraps the router client in the tanstack query utils', () => {
    const utils = createTanstackQueryClient<AnyRouter>({ url: 'https://api.example.com' });

    expect(createTanstackQueryUtils).toHaveBeenCalledTimes(1);
    expect(createTanstackQueryUtils).toHaveBeenCalledWith(createORPCClient.mock.results[0]?.value, undefined);
    expect(utils).toBe(createTanstackQueryUtils.mock.results[0]?.value);
  });

  it('forwards the utils options', () => {
    const utilsOptions = { path: ['todos'] };

    createTanstackQueryClient<AnyRouter>({ url: 'https://api.example.com' }, utilsOptions);

    expect(createTanstackQueryUtils).toHaveBeenCalledWith(createORPCClient.mock.results[0]?.value, utilsOptions);
  });

  it('shares one options object with `createRouterClient` without appending the rpc path twice', () => {
    const options = { url: 'https://api.example.com' };

    createRouterClient<AnyRouter>(options);
    createTanstackQueryClient<AnyRouter>(options);

    expect(linkOptionsAt(0).url).toBe('https://api.example.com/rpc');
    expect(linkOptionsAt(1).url).toBe('https://api.example.com/rpc');
    expect(options.url).toBe('https://api.example.com');
  });
});

describe('consumeStream', () => {
  it('is the event iterator consumer oRPC ships, under the name streams are declared with', () => {
    expect(consumeStream).toBe(consumeEventIterator);
  });
});
