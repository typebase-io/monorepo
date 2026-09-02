export type RunPrompt = <T>(ask: () => Promise<T>) => Promise<T>;

class StoppedAtPrompt extends Error {
  override name = 'StoppedAtPrompt';
}

export const runUntilStopped = async (run: (signal: AbortSignal, prompt: RunPrompt) => Promise<void>): Promise<void> => {
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

  const armStopKeys = (): void => {
    if (stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onKeyPress);
    }
  };

  const disarmStopKeys = (): void => {
    if (stdin.isTTY) {
      stdin.setRawMode(false);
      stdin.off('data', onKeyPress);
      stdin.pause();
    }
  };

  let restored = false;

  const restoreTerminal = (): void => {
    if (restored) {
      return;
    }

    restored = true;

    disarmStopKeys();

    process.off('SIGINT', onSigint);
  };

  const prompt: RunPrompt = async (ask) => {
    disarmStopKeys();

    try {
      return await ask();
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        controller.abort();

        throw new StoppedAtPrompt();
      }

      throw err;
    } finally {
      armStopKeys();
    }
  };

  armStopKeys();

  process.on('SIGINT', onSigint);
  process.on('exit', restoreTerminal);

  try {
    await run(controller.signal, prompt);
  } catch (err) {
    if (!(err instanceof StoppedAtPrompt)) {
      throw err;
    }
  } finally {
    restoreTerminal();
    process.off('exit', restoreTerminal);
  }
};
