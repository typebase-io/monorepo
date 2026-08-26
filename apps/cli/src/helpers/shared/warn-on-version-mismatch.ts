import { chalkStderr } from 'chalk';

import { getCliVersion } from '#helpers/shared/get-cli-version.ts';
import { getTypebaseIoVersion } from '#helpers/shared/get-typebase-io-version.ts';

export const warnOnVersionMismatch = () => {
  const cliVersion = getCliVersion();
  const typebaseIoVersion = getTypebaseIoVersion();

  if (!cliVersion || !typebaseIoVersion || cliVersion === typebaseIoVersion) {
    return;
  }

  console.error(
    chalkStderr.yellow(
      `Warning: this CLI is ${cliVersion}, but the installed \`typebase-io\` is ${typebaseIoVersion}. They are released together, so generated code and deploys can break while they differ. Install \`typebase-io@${cliVersion}\`, or run the CLI as \`npx typebase-io-cli@${typebaseIoVersion}\`.\n`
    )
  );
};
