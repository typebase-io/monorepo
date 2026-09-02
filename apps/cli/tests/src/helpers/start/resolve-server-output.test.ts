import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveServerOutput } from '#helpers/start/resolve-server-output.ts';

describe('resolveServerOutput', () => {
  let originalTypeScriptSupport: PropertyDescriptor | undefined;

  const pretendTypeScriptSupport = (value: unknown) => {
    Object.defineProperty(process.features, 'typescript', { value, configurable: true, enumerable: true });
  };

  beforeEach(() => {
    originalTypeScriptSupport = Object.getOwnPropertyDescriptor(process.features, 'typescript');
  });

  afterEach(() => {
    if (originalTypeScriptSupport) {
      Object.defineProperty(process.features, 'typescript', originalTypeScriptSupport);
    }
  });

  it.each([
    { name: 'type stripping', typescriptSupport: 'strip' },
    { name: 'type transformation', typescriptSupport: 'transform' },
  ])('runs TypeScript directly on a Node that supports $name', ({ typescriptSupport }) => {
    pretendTypeScriptSupport(typescriptSupport);

    expect(resolveServerOutput()).toEqual({ output: 'ts', warnAboutTranspiling: false });
  });

  it.each([
    { name: 'reports no TypeScript support', typescriptSupport: false },
    { name: 'is too old to know about the flag', typescriptSupport: undefined },
  ])('transpiles and warns on a Node that $name', ({ typescriptSupport }) => {
    pretendTypeScriptSupport(typescriptSupport);

    expect(resolveServerOutput()).toEqual({ output: 'esm', warnAboutTranspiling: true });
  });

  it.each(['ts', 'esm', 'cjs'] as const)('uses the requested %s output whatever the Node supports, without warning', (requested) => {
    pretendTypeScriptSupport('strip');

    expect(resolveServerOutput(requested)).toEqual({ output: requested, warnAboutTranspiling: false });

    pretendTypeScriptSupport(false);

    expect(resolveServerOutput(requested)).toEqual({ output: requested, warnAboutTranspiling: false });
  });

  it('decides from the Node running the CLI when nothing is requested', () => {
    expect(resolveServerOutput()).toEqual(
      typeof process.features.typescript === 'string' ? { output: 'ts', warnAboutTranspiling: false } : { output: 'esm', warnAboutTranspiling: true }
    );
  });
});
