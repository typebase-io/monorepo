export const requestLogger = `const logger = pino(pretty({ ignore: "pid,hostname", singleLine: true }));

const LOG_ENTRY = Symbol("typebase.logEntry");

interface LogEntry {
  action?: string;
  input?: unknown;
  error?: unknown;
}

const logEntryOf = (context: object) => (context as { [LOG_ENTRY]?: LogEntry })[LOG_ENTRY];

const startRequestLog = (req: IncomingMessage, res: ServerResponse) => {
  const entry: LogEntry = {};
  const startedAt = performance.now();
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  let written = false;

  const write = (outcome: number | string) => {
    if (written) {
      return;
    }

    written = true;

    const line = \`\${req.method} \${pathname} \${outcome} \${Math.round(performance.now() - startedAt)}ms\`;
    const fields = { action: entry.action, input: entry.input, err: entry.error };

    if (outcome === "failed" || res.statusCode >= 500) {
      logger.error(fields, line);
    } else if (res.statusCode >= 400) {
      logger.warn(fields, line);
    } else {
      logger.info(fields, line);
    }
  };

  res.once("finish", () => write(res.statusCode));
  res.once("close", () => write("aborted"));

  return {
    entry,
    fail: (error: unknown) => {
      entry.error = error;
      write("failed");
    },
  };
};`;
