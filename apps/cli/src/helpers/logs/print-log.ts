import chalk from 'chalk';
import { match } from 'ts-pattern';

export const printLog = ({
  timestampInMs,
  level,
  message,
  requestMethod,
  requestPath,
  responseStatusCode,
  traceId,
}: {
  timestampInMs: number;
  level: string;
  message: string;
  requestMethod?: string;
  requestPath?: string;
  responseStatusCode?: number;
  traceId?: string;
}): void => {
  const time = new Date(timestampInMs).toLocaleTimeString('en-GB', { hour12: false });

  const color = match(level)
    .with('error', 'fatal', () => chalk.red)
    .with('warning', () => chalk.yellow)
    .otherwise(() => chalk.cyan);

  const status = typeof responseStatusCode === 'number' && responseStatusCode > 0 ? ` ${responseStatusCode}` : '';
  const request = requestMethod && requestPath ? `${requestMethod} ${requestPath}${status}` : '';

  const parts = [
    chalk.dim(time),
    color(level.toUpperCase()),
    traceId ? chalk.dim(`[${traceId.slice(0, 8)}]`) : '',
    request ? chalk.dim(request) : '',
    message.trimEnd(),
  ].filter(Boolean);

  console.log(parts.join(' '));
};
