import fs from 'node:fs/promises';
import path from 'node:path';

import { match } from 'ts-pattern';

import { type ServerAdapter } from '#helpers/constants.ts';
import { getServerRouter } from '#helpers/shared/get-server-router.ts';
import { bunIndexFileTemplate } from '#helpers/templates/index-file/bun.ts';
import { cloudflareIndexFileTemplate } from '#helpers/templates/index-file/cloudflare.ts';
import { denoIndexFileTemplate } from '#helpers/templates/index-file/deno.ts';
import { fastifyIndexFileTemplate } from '#helpers/templates/index-file/fastify.ts';
import { honoIndexFileTemplate } from '#helpers/templates/index-file/hono.ts';
import { nodeIndexFileTemplate } from '#helpers/templates/index-file/node.ts';

export const generateIndex = async ({
  adapter,
  port,
  tsConfigFilePath,
  actionsDirPath,
  outputFilePath,
  actionsOutputDirPath,
  generation,
  hasAuth,
  hasEnv,
  trustedOrigins,
}: {
  adapter: ServerAdapter;
  port: number;
  tsConfigFilePath: string;
  actionsDirPath: string;
  outputFilePath: string;
  actionsOutputDirPath: string;
  generation: 'ts' | 'esm' | 'cjs';
  hasAuth: boolean;
  hasEnv: boolean;
  trustedOrigins: string[];
}) => {
  const [routerImports, router] = await getServerRouter({
    tsConfigFilePath,
    actionsDirPath,
    outputFilePath,
    actionsOutputDirPath,
    generation,
    exportable: false,
  });

  const routerCode = [routerImports, router].filter(Boolean).join('\n\n');

  let indexFile = match(adapter)
    .with('node', () => nodeIndexFileTemplate(routerCode, port, hasAuth, trustedOrigins))
    .with('bun', () => bunIndexFileTemplate(routerCode, port, hasAuth))
    .with('cloudflare', () => cloudflareIndexFileTemplate(routerCode, hasAuth))
    .with('deno', () => denoIndexFileTemplate(routerCode, port, hasAuth))
    .with('fastify', () => fastifyIndexFileTemplate(routerCode, port, hasAuth, trustedOrigins))
    .with('hono', () => honoIndexFileTemplate(routerCode, hasAuth, trustedOrigins))
    .exhaustive();

  if (hasEnv) {
    indexFile = `import "${generation === 'ts' ? './env.ts' : './env.js'}";\n\n${indexFile}`;
  }

  if (hasEnv && adapter !== 'cloudflare') {
    indexFile = `import 'dotenv/config';\n\n${indexFile}`;
  }

  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
  await fs.writeFile(outputFilePath, indexFile);
};
