import { printLog } from '#helpers/logs/print-log.ts';

interface DenoRuntimeLog {
  timestamp: string;
  level: string;
  message: string;
  revision_id?: string;
  region?: string;
  trace_id?: string;
}

export const printLine = (line: string, lastPrinted: string): string => {
  const trimmed = line.trim();

  if (!trimmed) {
    return lastPrinted;
  }

  let log: DenoRuntimeLog;

  try {
    log = JSON.parse(trimmed) as DenoRuntimeLog;
  } catch {
    console.log(trimmed);

    return lastPrinted;
  }

  if (lastPrinted && log.timestamp <= lastPrinted) {
    return lastPrinted;
  }

  printLog({
    timestampInMs: new Date(log.timestamp).getTime(),
    level: log.level === 'warn' ? 'warning' : log.level,
    message: log.message,
    traceId: log.trace_id,
  });

  return log.timestamp;
};
