#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { chalkStderr } from 'chalk';

import { buildLibrary } from '#commands/build-library.ts';
import { build } from '#commands/build.ts';

const main = async () => {
  const program = new Command();

  program.name('build-apps').usage('<command> [options]').addCommand(build).addCommand(buildLibrary);

  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(chalkStderr.red(`Unexpected Error: ${e}`));
    process.exitCode = 1;
  }

  process.exit();
};

void main();
