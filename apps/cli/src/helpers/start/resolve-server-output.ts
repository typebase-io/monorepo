import { type ServerOutput } from '#helpers/constants.ts';

export const resolveServerOutput = (requested?: ServerOutput): { output: ServerOutput; warnAboutTranspiling: boolean } => {
  if (requested) {
    return { output: requested, warnAboutTranspiling: false };
  }

  const canRunTypeScript = typeof process.features.typescript === 'string';

  return canRunTypeScript ? { output: 'ts', warnAboutTranspiling: false } : { output: 'esm', warnAboutTranspiling: true };
};
