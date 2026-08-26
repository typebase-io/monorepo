import { findPackageVersion } from '#helpers/shared/find-package-version.ts';

export const getCliVersion = () => {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return undefined;
  }

  return findPackageVersion({ fromPath: entrypoint, packageName: 'typebase-io-cli' });
};
