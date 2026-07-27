import { type VercelClient } from '#helpers/deploy/vercel/client.ts';
import { printLog } from '#helpers/logs/print-log.ts';

type RequestLogRow = Awaited<ReturnType<VercelClient['getRequestLogs']>>[number];

const LEVEL_SEVERITY: Record<string, number> = { info: 0, warning: 1, error: 2, fatal: 3 };

export const printLine = (row: RequestLogRow): void => {
  const timestampInMs = row.timestamp === undefined ? Date.now() : new Date(row.timestamp).getTime();

  const display = (row.logs ?? []).reduce<{ level?: string; message?: string } | undefined>((selected, current) => {
    if (!selected || (LEVEL_SEVERITY[current.level ?? 'info'] ?? 0) > (LEVEL_SEVERITY[selected.level ?? 'info'] ?? 0)) {
      return current;
    }

    return selected;
  }, undefined);

  printLog({
    timestampInMs,
    level: display?.level ?? 'info',
    message: display?.message ?? '',
    requestMethod: row.requestMethod,
    requestPath: row.requestPath,
    responseStatusCode: row.statusCode,
  });
};
