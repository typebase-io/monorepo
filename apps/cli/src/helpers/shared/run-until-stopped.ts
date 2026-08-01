export const runUntilStopped = async (run: (signal: AbortSignal) => Promise<void>): Promise<void> => {
  const controller = new AbortController();
  const stdin = process.stdin;

  const onKeyPress = (data: Buffer): void => {
    const key = data.toString();

    if (key === 'x' || key === 'X' || key === '\u0003') {
      controller.abort();
    }
  };

  const onSigint = (): void => {
    controller.abort();
  };

  let restored = false;

  const restoreTerminal = (): void => {
    if (restored) {
      return;
    }

    restored = true;

    if (stdin.isTTY) {
      stdin.setRawMode(false);
      stdin.off('data', onKeyPress);
      stdin.pause();
    }

    process.off('SIGINT', onSigint);
  };

  if (stdin.isTTY) {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onKeyPress);
  }

  process.on('SIGINT', onSigint);
  process.on('exit', restoreTerminal);

  try {
    await run(controller.signal);
  } finally {
    restoreTerminal();
    process.off('exit', restoreTerminal);
  }
};
