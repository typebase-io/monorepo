#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { chalkStderr } from 'chalk';

import { buildApp } from '#commands/build-app.ts';
import { buildLibrary } from '#commands/build-library.ts';
import { compareDocs } from '#commands/compare-docs.ts';

const main = async () => {
  const program = new Command();

  program.name('tools').usage('<command> [options]').addCommand(buildApp).addCommand(buildLibrary).addCommand(compareDocs);

  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(chalkStderr.red(`Unexpected Error: ${e}`));
    process.exitCode = 1;
  }

  process.exit();
};

void main();
