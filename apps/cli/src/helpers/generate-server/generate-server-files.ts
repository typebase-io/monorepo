import fs from 'node:fs/promises';
import path from 'node:path';

import { match } from 'ts-pattern';

import { type ServerAdapter, type ServerMode, type ServerOutput } from '#helpers/constants.ts';
import { getServerRouter } from '#helpers/shared/get-server-router.ts';
import { bunIndexFileTemplate } from '#helpers/templates/index-file/bun.ts';
import { cloudflareIndexFileTemplate } from '#helpers/templates/index-file/cloudflare.ts';
import { denoIndexFileTemplate } from '#helpers/templates/index-file/deno.ts';
import { fastifyIndexFileTemplate } from '#helpers/templates/index-file/fastify.ts';
import { honoIndexFileTemplate } from '#helpers/templates/index-file/hono.ts';
import { nodeIndexFileTemplate } from '#helpers/templates/index-file/node.ts';
import { bunServerFileTemplate } from '#helpers/templates/server-file/bun.ts';
import { cloudflareServerFileTemplate } from '#helpers/templates/server-file/cloudflare.ts';
import { denoServerFileTemplate } from '#helpers/templates/server-file/deno.ts';
import { fastifyServerFileTemplate } from '#helpers/templates/server-file/fastify.ts';
import { honoServerFileTemplate } from '#helpers/templates/server-file/hono.ts';
import { nodeServerFileTemplate } from '#helpers/templates/server-file/node.ts';

export const generateServerFiles = async ({
  adapter,
  mode,
  port,
  tsConfigFilePath,
  actionsDirPath,
  outputDirPath,
  actionsOutputDirPath,
  generation,
  hasAuth,
  hasEnv,
  trustedOrigins,
  actionsPath,
  authPath,
}: {
  adapter: ServerAdapter;
  mode: ServerMode;
  port: number;
  tsConfigFilePath: string;
  actionsDirPath: string;
  outputDirPath: string;
  actionsOutputDirPath: string;
  generation: ServerOutput;
  hasAuth: boolean;
  hasEnv: boolean;
  trustedOrigins: string[];
  actionsPath: string;
  authPath: string | { fromAuth: true };
}) => {
  const serverFilePath = path.join(outputDirPath, 'server.ts');
  const indexFilePath = path.join(outputDirPath, 'index.ts');

  const [routerImports, router] = await getServerRouter({
    tsConfigFilePath,
    actionsDirPath,
    outputFilePath: serverFilePath,
    actionsOutputDirPath,
    generation,
  });

  const routerCode = [routerImports, router].filter(Boolean).join('\n\n');

  const options = { routerCode, hasAuth, trustedOrigins, mode, actionsPath, authPath };

  const [serverFile, bootstrap] = match(adapter)
    .returnType<[string, string]>()
    .with('node', () => [nodeServerFileTemplate(options), nodeIndexFileTemplate(port)])
    .with('bun', () => [bunServerFileTemplate(options), bunIndexFileTemplate(port)])
    .with('cloudflare', () => [cloudflareServerFileTemplate(options), cloudflareIndexFileTemplate])
    .with('deno', () => [denoServerFileTemplate(options), denoIndexFileTemplate(port)])
    .with('fastify', () => [fastifyServerFileTemplate(options), fastifyIndexFileTemplate(port, hasAuth, trustedOrigins)])
    .with('hono', () => [honoServerFileTemplate(options), honoIndexFileTemplate])
    .exhaustive();

  const envImports = [
    hasEnv && adapter !== 'cloudflare' ? `import 'dotenv/config';\n\n` : '',
    hasEnv ? `import "${generation === 'ts' ? './env.ts' : './env.js'}";\n\n` : '',
  ].join('');

  const indexFile = `${envImports}${bootstrap}`;

  await fs.mkdir(outputDirPath, { recursive: true });

  await fs.writeFile(serverFilePath, serverFile);

  if (mode === 'standalone') {
    await fs.writeFile(indexFilePath, indexFile);
  }
};
