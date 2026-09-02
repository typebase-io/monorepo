import { type ChildProcess } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { stopProcessTree } from '#helpers/generate-server/stop-process-tree.ts';

const fakeChild = ({ pid = 4242, exitCode = null, signalCode = null }: { pid?: number; exitCode?: number | null; signalCode?: string | null } = {}) =>
  ({ pid, exitCode, signalCode, kill: vi.fn() }) as unknown as ChildProcess & { kill: ReturnType<typeof vi.fn> };

const onPlatform = (platform: string, run: () => void) => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');

  Object.defineProperty(process, 'platform', { value: platform, configurable: true });

  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(process, 'platform', original);
    }
  }
};

describe('stopProcessTree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signals the whole process group, so the shell takes the server with it', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const child = fakeChild({ pid: 4242 });

    onPlatform('darwin', () => {
      stopProcessTree(child);
    });

    expect(kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    expect(child.kill).not.toHaveBeenCalled();
  });

  it.each(['SIGTERM', 'SIGKILL'] as const)('sends %s when asked to', (signal) => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const child = fakeChild({ pid: 99 });

    onPlatform('darwin', () => {
      stopProcessTree(child, signal);
    });

    expect(kill).toHaveBeenCalledWith(-99, signal);
  });

  it('falls back to the child when the group cannot be signalled', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });

    const child = fakeChild();

    onPlatform('darwin', () => {
      stopProcessTree(child);
    });

    expect(child.kill).toHaveBeenCalledOnce();
  });

  it('signals the child on windows, which has no process group to signal', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const child = fakeChild();

    onPlatform('win32', () => {
      stopProcessTree(child);
    });

    expect(kill).not.toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it('falls back to the child when it has no pid to derive a group from', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const child = { pid: undefined, exitCode: null, signalCode: null, kill: vi.fn() } as unknown as ChildProcess & { kill: ReturnType<typeof vi.fn> };

    onPlatform('darwin', () => {
      stopProcessTree(child);
    });

    expect(kill).not.toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'already exited', child: () => fakeChild({ exitCode: 0 }) },
    { name: 'already signalled', child: () => fakeChild({ signalCode: 'SIGTERM' }) },
  ])('still signals the group of a child that is $name, to reach stragglers', ({ child: make }) => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const child = make();

    onPlatform('darwin', () => {
      stopProcessTree(child);
    });

    expect(kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
  });

  it('does not throw when the group is already empty', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });

    const child = fakeChild({ exitCode: 0 });

    expect(() => {
      onPlatform('darwin', () => {
        stopProcessTree(child);
      });
    }).not.toThrow();
  });
});
