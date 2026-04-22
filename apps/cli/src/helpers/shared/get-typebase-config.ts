import { existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { chalkStderr } from 'chalk';
import { z } from 'zod';

import { TYPEBASE_CONFIG_FILE_NAME, typebaseConfigSchema } from '#helpers/constants.ts';

export const getTypebaseConfig = async () => {
  const typebaseConfigPath = path.resolve(TYPEBASE_CONFIG_FILE_NAME);
  const hasSrcDir = existsSync(path.resolve('src')) && statSync(path.resolve('src')).isDirectory();
  const configContent = await (existsSync(typebaseConfigPath) ? fs.readFile(typebaseConfigPath, 'utf8') : '{}');

  const config = z
    .string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str) as unknown;
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid JSON - ${(error as Error).message}`,
          fatal: true,
        });
      }
    })
    .pipe(typebaseConfigSchema)
    .safeParse(configContent);

  if (!config.success) {
    console.error(chalkStderr.red(`\`typebase.json\` is invalid.\n${z.prettifyError(config.error)}`));
    process.exit(1);
  }

  return {
    projectPath: config.data.projectPath ?? (hasSrcDir ? 'src/typebase' : 'typebase'),
    serverProvider: config.data.serverProvider,
    server: {
      output: config.data.server?.output ?? 'ts',
      adapter: config.data.server?.adapter ?? 'node',
      skipLoadEnv: config.data.server?.skipLoadEnv ?? false,
      outDir: config.data.server?.outDir ?? '_server',
    },
    vercel: config.data.vercel,
    cloudflare: config.data.cloudflare,
    deno: config.data.deno,
    neon: config.data.neon,
  };
};
