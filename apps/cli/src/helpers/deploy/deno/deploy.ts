import fs from 'node:fs/promises';
import path from 'node:path';

import ora from 'ora';

import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { walk } from '#helpers/shared/walk.ts';

export const deploy = async ({
  token,
  projectId,
  serverDirPath,
  target,
}: {
  token: string;
  projectId: string;
  serverDirPath: string;
  target: 'dev' | 'prod';
}): Promise<{ revisionId: string }> => {
  const { server } = await getTypebaseConfig();

  const textExtensions = new Set(['.js', '.ts', '.json', '.map', '.txt', '.html', '.css', '.svg', '.xml', '.yaml', '.yml', '.toml', '.md']);
  const prepareSpinner = ora('Preparing files...').start();
  const skipDirs = new Set(['node_modules', 'dist', 'build', server.outDir]);
  const filePaths = await walk(serverDirPath, { skipDirs: (name) => skipDirs.has(name) });

  const fileEntries = await Promise.all(
    filePaths.map(async (absPath) => {
      const relativePath = path.relative(serverDirPath, absPath).replace(/\\/g, '/');
      const ext = path.extname(absPath).toLowerCase();
      const isText = textExtensions.has(ext);
      const content = await fs.readFile(absPath, isText ? 'utf-8' : 'base64');

      return [
        relativePath,
        {
          kind: 'file',
          content,
          encoding: isText ? 'utf-8' : 'base64',
        },
      ] as const;
    })
  );

  prepareSpinner.succeed(`Prepared ${filePaths.length} file(s).`);

  const deploySpinner = ora('Creating deployment...').start();
  const installCommand = await getPackageManagerInstallCommand('npm');

  const res = await fetch(`https://api.deno.com/v2/apps/${projectId}/deploy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assets: Object.fromEntries(fileEntries),
      config: {
        install: installCommand,
        build: null,
        runtime: {
          type: 'dynamic',
          entrypoint: 'src/index.js',
        },
      },
      preview: target === 'dev',
      production: target === 'prod',
    }),
  });

  if (!res.ok) {
    deploySpinner.fail('Failed to create deployment.');

    const body = await res.text();

    throw new Error(`Deno Deploy API error: ${body}`);
  }

  const revision = (await res.json()) as { id: string };

  deploySpinner.succeed('Deployment created.');

  return { revisionId: revision.id };
};
