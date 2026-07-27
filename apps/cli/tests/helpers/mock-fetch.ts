import { vi } from 'vitest';

export interface MockFetchResult {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
  body?: ReadableStream<Uint8Array> | null;
}

export interface RecordedFetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  rawBody?: RequestInit['body'];
}

export const mockFetch = (handler: (url: string, init?: RequestInit) => MockFetchResult) => {
  const calls: RecordedFetchCall[] = [];

  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string> | undefined) ?? {},
      body: typeof init?.body === 'string' ? init.body : undefined,
      rawBody: init?.body,
    });

    const result = handler(url, init);
    const headers = result.headers ?? {};

    return Promise.resolve({
      ok: result.ok ?? true,
      status: result.status ?? 200,
      statusText: result.statusText ?? '',
      json: () => Promise.resolve(result.json),
      text: () => Promise.resolve(result.text ?? ''),
      body: result.body ?? null,
      headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    } as Response);
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    fetchMock,
    restore: () => {
      vi.unstubAllGlobals();
    },
  };
};
