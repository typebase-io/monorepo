#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { chalkStderr } from 'chalk';

import { auth } from '#commands/auth.ts';
import { codegen } from '#commands/codegen.ts';
import { db } from '#commands/db.ts';
import { deploy } from '#commands/deploy.ts';
import { env } from '#commands/env.ts';
import { generateServer } from '#commands/generate-server.ts';
import { init } from '#commands/init.ts';

const main = async () => {
  const program = new Command();

  program
    .name('typebase-io-cli')
    .usage('<command> [options]')
    .description('Start developing with Typebase by running `npx typebase-io-cli init`.')
    .addCommand(init)
    .addCommand(codegen)
    .addCommand(generateServer)
    .addCommand(auth)
    .addCommand(db)
    .addCommand(deploy)
    .addCommand(env);

  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(chalkStderr.red(`Unexpected Error: ${e}`));
    process.exitCode = 1;
  }

  process.exit();
};

void main();
