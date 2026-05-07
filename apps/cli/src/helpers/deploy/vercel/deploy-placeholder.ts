import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import ora from 'ora';

import { DEPS } from '#helpers/constants.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { waitForDeployment } from '#helpers/deploy/vercel/wait-for-deployment.ts';
import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';

export const deployPlaceholder = async ({
  token,
  projectName,
  orgId,
}: {
  token: string;
  projectName: string;
  orgId: string | undefined;
}): Promise<void> => {
  const vercel = new VercelClient({ token, orgId });
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'typebase-placeholder-'));

  try {
    const files = [
      {
        file: 'package.json',
        content: `${JSON.stringify(
          {
            name: 'placeholder',
            version: '0.0.0',
            type: 'module',
            main: 'index.js',
            dependencies: { hono: DEPS.hono.version },
          },
          null,
          2
        )}\n`,
      },
      {
        file: 'index.js',
        content: 'import { Hono } from "hono";\n\nconst app = new Hono();\napp.all("*", (c) => c.text("Placeholder..."));\n\nexport default app;\n',
      },
    ];

    const fileRefs = await Promise.all(
      files.map(async ({ file, content }) => {
        const absPath = path.join(tempDir, file);
        await fs.writeFile(absPath, content);
        const buffer = await fs.readFile(absPath);

        return {
          file,
          absPath,
          sha: crypto.createHash('sha1').update(buffer).digest('hex'),
          size: buffer.byteLength,
        };
      })
    );

    const installCommand = await getPackageManagerInstallCommand('npm');

    const spinner = ora('Seeding production with a placeholder deployment...').start();
    let deploymentId = '';

    const result = await vercel.createDeployment({
      name: projectName,
      target: 'prod',
      files: fileRefs.map(({ file, sha, size }) => ({ file, sha, size })),
      projectSettings: { installCommand, framework: 'hono' },
    });

    if (result.status === 'missing_files') {
      const missingRefs = fileRefs.filter((ref) => result.missing.includes(ref.sha));

      await vercel.uploadFiles({ files: missingRefs });

      const retryResult = await vercel.createDeployment({
        name: projectName,
        target: 'prod',
        files: fileRefs.map(({ file, sha, size }) => ({ file, sha, size })),
        projectSettings: { installCommand, framework: 'hono' },
      });

      if (retryResult.status !== 'ok') {
        spinner.fail('Placeholder deployment failed.');
        throw new Error('Placeholder deployment still reports missing files after upload.');
      }

      deploymentId = retryResult.id;
    } else {
      deploymentId = result.id;
    }

    spinner.succeed('Placeholder production deployment created.');

    await waitForDeployment({ token, deploymentId, orgId, type: 'placeholder' });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};
