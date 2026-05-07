import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import ora from 'ora';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { walk } from '#helpers/shared/walk.ts';

export const deploy = async ({
  token,
  projectName,
  orgId,
  serverDirPath,
  target,
}: {
  token: string;
  projectName: string;
  orgId: string | undefined;
  serverDirPath: string;
  target: 'dev' | 'prod';
}): Promise<{ deploymentId: string; url: string }> => {
  const { server } = await getTypebaseConfig();

  const vercel = new VercelClient({ token, orgId });

  const hashSpinner = ora('Preparing files...').start();
  const skipDirs = new Set(['node_modules', 'dist', 'build', ...(server.outDir ? [server.outDir] : [])]);
  const filePaths = await walk(serverDirPath, { skipDirs: (name) => skipDirs.has(name) });
  const installCommand = await getPackageManagerInstallCommand('npm');

  const fileRefs = await Promise.all(
    filePaths.map(async (absPath) => {
      const content = await fs.readFile(absPath);

      return {
        file: path.relative(serverDirPath, absPath).replace(/\\/g, '/'),
        sha: crypto.createHash('sha1').update(content).digest('hex'),
        size: content.byteLength,
        absPath,
      };
    })
  );

  hashSpinner.succeed(`Prepared ${fileRefs.length} file(s).`);

  const deploySpinner = ora('Creating deployment...').start();

  const result = await vercel.createDeployment({
    name: projectName,
    target,
    files: fileRefs.map(({ file, sha, size }) => ({ file, sha, size })),
    projectSettings: {
      installCommand,
      framework: 'hono',
    },
  });

  if (result.status === 'ok') {
    deploySpinner.succeed('Deployment created.');

    return {
      deploymentId: result.id,
      url: result.url,
    };
  }

  const missingRefs = fileRefs.filter((ref) => result.missing.includes(ref.sha));
  await vercel.uploadFiles({ files: missingRefs });

  const retryResult = await vercel.createDeployment({
    name: projectName,
    target,
    files: fileRefs.map(({ file, sha, size }) => ({ file, sha, size })),
    projectSettings: {
      installCommand,
      framework: 'hono',
    },
  });

  if (retryResult.status !== 'ok') {
    deploySpinner.fail('Failed to create deployment after uploading files.');

    throw new Error('Deployment still reports missing files after upload.');
  }

  deploySpinner.succeed('Deployment created.');

  return {
    deploymentId: retryResult.id,
    url: retryResult.url,
  };
};
