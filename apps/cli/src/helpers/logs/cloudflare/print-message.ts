import { match } from 'ts-pattern';

import { printLog } from '#helpers/logs/print-log.ts';

interface TailEventMessage {
  outcome: string;
  eventTimestamp: number;
  event?: { request?: { url: string; method: string }; response?: { status: number } } | null;
  logs?: { message: unknown[]; level: string; timestamp: number }[];
  exceptions?: { name: string; message: unknown; timestamp: number; stack?: string }[];
}

export const printMessage = (data: string | ArrayBuffer): void => {
  const raw = typeof data === 'string' ? data : new TextDecoder().decode(data);
  const trimmed = raw.trim();

  if (!trimmed) {
    return;
  }

  let message: TailEventMessage;

  try {
    message = JSON.parse(trimmed) as TailEventMessage;
  } catch {
    console.log(trimmed);

    return;
  }

  const request = message.event?.request;

  if (request) {
    let requestPath = request.url;

    try {
      const url = new URL(request.url);

      requestPath = `${url.pathname}${url.search}`;
    } catch {
      // keep the raw url when it is not absolute
    }

    printLog({
      timestampInMs: message.eventTimestamp,
      level: message.outcome === 'ok' ? 'info' : 'error',
      message: message.outcome === 'ok' ? '' : message.outcome,
      requestMethod: request.method,
      requestPath,
      responseStatusCode: message.event?.response?.status,
    });
  }

  for (const log of message.logs ?? []) {
    printLog({
      timestampInMs: log.timestamp,
      level: match(log.level)
        .with('warn', () => 'warning')
        .with('log', () => 'info')
        .otherwise(() => log.level),
      message: log.message.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' '),
    });
  }

  for (const exception of message.exceptions ?? []) {
    const text = typeof exception.message === 'string' ? exception.message : JSON.stringify(exception.message);

    printLog({
      timestampInMs: exception.timestamp,
      level: 'error',
      message: `${exception.name}: ${text}${exception.stack ? `\n${exception.stack}` : ''}`,
    });
  }
};
