import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({
  getCliVersion: vi.fn<() => string | undefined>(),
  getTypebaseIoVersion: vi.fn<() => string | undefined>(),
}));

vi.mock('#helpers/shared/get-cli-version.ts', () => ({ getCliVersion: spies.getCliVersion }));
vi.mock('#helpers/shared/get-typebase-io-version.ts', () => ({ getTypebaseIoVersion: spies.getTypebaseIoVersion }));

const { warnOnVersionMismatch } = await import('#helpers/shared/warn-on-version-mismatch.ts');

describe('warnOnVersionMismatch', () => {
  const warnings = () => vi.mocked(console.error).mock.calls.flat().map(String).join('\n');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when the CLI and typebase-io versions differ', () => {
    spies.getCliVersion.mockReturnValue('0.1.14');
    spies.getTypebaseIoVersion.mockReturnValue('0.1.12');

    warnOnVersionMismatch();

    expect(warnings()).toContain('this CLI is 0.1.14, but the installed `typebase-io` is 0.1.12');
    expect(warnings()).toContain('typebase-io@0.1.14');
    expect(warnings()).toContain('typebase-io-cli@0.1.12');
  });

  it('stays quiet when both versions match', () => {
    spies.getCliVersion.mockReturnValue('0.1.14');
    spies.getTypebaseIoVersion.mockReturnValue('0.1.14');

    warnOnVersionMismatch();

    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    ['the CLI version is unknown', undefined, '0.1.14'],
    ['the typebase-io version is unknown', '0.1.14', undefined],
    ['neither version is known', undefined, undefined],
  ] as const)('stays quiet when %s', (_label, cliVersion, typebaseIoVersion) => {
    spies.getCliVersion.mockReturnValue(cliVersion);
    spies.getTypebaseIoVersion.mockReturnValue(typebaseIoVersion);

    warnOnVersionMismatch();

    expect(console.error).not.toHaveBeenCalled();
  });
});
