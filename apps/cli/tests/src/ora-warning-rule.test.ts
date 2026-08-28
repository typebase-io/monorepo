import type * as Ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('the rule ora warns on', () => {
  let warnings: string[];
  let stream: NodeJS.WriteStream;

  const options = () => ({ stream, hideCursor: false, discardStdin: false });

  beforeEach(() => {
    warnings = [];

    stream = {
      isTTY: true,
      columns: 80,
      write: () => true,
      cursorTo: () => true,
      clearLine: () => true,
      moveCursor: () => true,
    } as unknown as NodeJS.WriteStream;

    vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const concurrent = () => warnings.filter((warning) => warning.includes('Multiple concurrent spinners'));

  it('warns when a spinner starts while another is running', async () => {
    const { default: ora } = await vi.importActual<typeof Ora>('ora');

    const outer = ora(options()).start('outer');
    const inner = ora(options()).start('inner');

    inner.stop();
    outer.stop();

    expect(concurrent()).toHaveLength(1);
  });

  it('does not warn once the first spinner has stopped', async () => {
    const { default: ora } = await vi.importActual<typeof Ora>('ora');

    ora(options()).start('first').stop();
    ora(options()).start('second').stop();

    expect(concurrent()).toEqual([]);
  });

  it('does not warn for a spinner that reports without ever starting', async () => {
    const { default: ora } = await vi.importActual<typeof Ora>('ora');

    const outer = ora(options()).start('outer');

    ora(options()).succeed('a one-off line');
    ora(options()).info('another one');

    outer.stop();

    expect(concurrent()).toEqual([]);
  });

  it.each(['succeed', 'fail', 'warn', 'info'] as const)('treats %s as stopping the spinner', async (method) => {
    const { default: ora } = await vi.importActual<typeof Ora>('ora');

    const first = ora(options()).start('first');

    first[method]('done');

    ora(options()).start('second').stop();

    expect(concurrent()).toEqual([]);
  });
});
