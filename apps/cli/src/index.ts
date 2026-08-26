#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { chalkStderr } from 'chalk';

import { auth } from '#commands/auth.ts';
import { codegen } from '#commands/codegen.ts';
import { config } from '#commands/config.ts';
import { db } from '#commands/db.ts';
import { deploy } from '#commands/deploy.ts';
import { env } from '#commands/env.ts';
import { generateServer } from '#commands/generate-server.ts';
import { init } from '#commands/init.ts';
import { logs } from '#commands/logs.ts';

import { getCliVersion } from '#helpers/shared/get-cli-version.ts';
import { isTypebaseIoInstalled } from '#helpers/shared/is-typebase-io-installed.ts';
import { warnOnVersionMismatch } from '#helpers/shared/warn-on-version-mismatch.ts';

const main = async () => {
  const program = new Command();
  const cliVersion = getCliVersion();

  program
    .name('typebase-io-cli')
    .usage('<command> [options]')
    .description('Start developing with Typebase by running `npx typebase-io-cli init`.')
    .hook('preSubcommand', (_program, subcommand) => {
      if (subcommand.name() === 'env' || subcommand.name() === 'logs' || subcommand.name() === 'config') {
        return;
      }

      if (!isTypebaseIoInstalled()) {
        subcommand.error(
          chalkStderr.red(
            `\`${subcommand.name()}\` needs the \`typebase-io\` package, but it is not installed. Install it first (e.g. \`npm install typebase-io\`), then run this command again.`
          )
        );

        return;
      }

      warnOnVersionMismatch();
    })
    .addCommand(init)
    .addCommand(codegen)
    .addCommand(generateServer)
    .addCommand(auth)
    .addCommand(db)
    .addCommand(deploy)
    .addCommand(logs)
    .addCommand(env)
    .addCommand(config);

  if (cliVersion) {
    program.version(cliVersion, '-V, --version', 'Print the CLI version');
  }

  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(chalkStderr.red(`Unexpected Error: ${e}`));
    process.exitCode = 1;
  }

  process.exit();
};

void main();
