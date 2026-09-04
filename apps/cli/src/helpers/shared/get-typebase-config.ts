import { existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { chalkStderr } from 'chalk';
import { z } from 'zod';

import {
  DEFAULT_ACTIONS_PATH,
  DEFAULT_AUTH_PATH,
  DEFAULT_SERVER_OUT_DIRS,
  TYPEBASE_CONFIG_FILE_NAME,
  typebaseConfigSchema,
} from '#helpers/constants.ts';

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
      embedded: config.data.server?.embedded ?? false,
      outDir: config.data.server?.outDir ?? DEFAULT_SERVER_OUT_DIRS[config.data.server?.embedded ? 'embedded' : 'standalone'],
      explicitOutDir: config.data.server?.outDir,
      actionsPath: config.data.server?.actionsPath ?? DEFAULT_ACTIONS_PATH,
      authPath: config.data.server?.authPath ?? DEFAULT_AUTH_PATH,
      port: config.data.server?.port ?? 8080,
    },
    vercel: config.data.vercel,
    cloudflare: config.data.cloudflare,
    deno: config.data.deno,
    neon: config.data.neon,
  };
};
