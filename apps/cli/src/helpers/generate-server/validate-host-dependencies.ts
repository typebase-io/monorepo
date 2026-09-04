import ora from 'ora';
import { intersects, satisfies, valid, validRange } from 'semver';

import { getUserPackageInfo } from '#helpers/shared/get-user-package-info.ts';

export const validateHostDependencies = async ({ hostDirPath, dependencies }: { hostDirPath: string; dependencies: Record<string, string> }) => {
  const host = await getUserPackageInfo(hostDirPath).catch(() => undefined);

  if (!host) {
    ora().warn(
      `Cannot validate host dependencies: no package.json was found above \`${hostDirPath}\`. See typebase-server.json for the required dependencies.`
    );

    return { dependenciesToInstall: { ...dependencies }, hostDirPath: undefined };
  }

  const declaredDependencies = { ...host.packageJson.devDependencies, ...host.packageJson.dependencies, ...host.packageJson.optionalDependencies };
  const dependenciesToInstall: Record<string, string> = {};

  for (const [name, required] of Object.entries(dependencies)) {
    const declared = declaredDependencies[name];

    if (declared === undefined) {
      dependenciesToInstall[name] = required;

      continue;
    }

    if (!validRange(declared) || !validRange(required)) {
      ora().warn(
        `Cannot validate host dependency \`${name}@${declared}\` against \`${required}\` using semver. Check that it supports the generated server.`
      );

      continue;
    }

    const compatible = valid(required) ? satisfies(required, declared) : intersects(required, declared);

    if (!compatible) {
      dependenciesToInstall[name] = required;

      ora().warn(
        `Host dependency \`${name}@${declared}\` does not include the generated server requirement \`${required}\`. Update the host dependency.`
      );
    }
  }

  return { dependenciesToInstall, hostDirPath: host.dirPath };
};
