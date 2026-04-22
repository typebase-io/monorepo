import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { builtinModules } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import esbuild from 'esbuild';
import ora from 'ora';

import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';

export const deploy = async ({
  token,
  accountId,
  workerName,
  serverDirPath,
  env,
}: {
  token: string;
  accountId: string;
  workerName: string;
  serverDirPath: string;
  env: { key: string; value: string; secret: boolean }[];
}): Promise<{ deploymentId: string }> => {
  const NODE_BUILT_IN_NAMESPACE = 'node-built-in-modules';
  const nodeBuiltinRegexp = new RegExp(`^(${builtinModules.join('|')}|node:.+)$`);

  const installSpinner = ora('Installing dependencies...').start();
  const installCommand = await getPackageManagerInstallCommand();
  const [cmd = '', ...args] = installCommand.split(' ');

  try {
    await promisify(execFile)(cmd, args, { cwd: serverDirPath });
    installSpinner.succeed('Dependencies installed.');
  } catch (err) {
    installSpinner.fail('Failed to install dependencies.');
    throw err;
  }

  const bundleSpinner = ora('Bundling worker...').start();
  const tempBundlePath = path.join(os.tmpdir(), `typebase-cf-bundle-${Date.now()}.js`);

  try {
    await esbuild.build({
      entryPoints: [path.join(serverDirPath, 'src', 'index.js')],
      bundle: true,
      format: 'esm',
      target: 'esnext',
      conditions: ['workerd', 'worker', 'browser'],
      plugins: [
        {
          name: 'nodejs-compat',
          setup(build) {
            build.onResolve({ filter: /^cloudflare:/ }, () => ({ external: true }));

            build.onResolve({ filter: nodeBuiltinRegexp }, (args) => {
              if (args.kind === 'require-call') {
                return { path: args.path, namespace: NODE_BUILT_IN_NAMESPACE };
              }

              return { path: args.path.startsWith('node:') ? args.path : `node:${args.path}`, external: true };
            });

            build.onLoad({ filter: /.*/, namespace: NODE_BUILT_IN_NAMESPACE }, ({ path: modulePath }) => {
              const specifier = modulePath.startsWith('node:') ? modulePath : `node:${modulePath}`;

              return {
                contents: `import mod from '${specifier}'; module.exports = mod;`,
                loader: 'js',
              };
            });
          },
        },
      ],
      outfile: tempBundlePath,
      logLevel: 'silent',
    });

    bundleSpinner.succeed('Worker bundled.');
  } catch (err) {
    bundleSpinner.fail('Failed to bundle worker.');
    throw err;
  }

  const deploySpinner = ora('Uploading worker...').start();

  const bundledContent = await fs.readFile(tempBundlePath, 'utf-8');
  await fs.rm(tempBundlePath, { force: true });

  const bindings = env.map(({ key, value, secret }) => ({
    type: secret ? 'secret_text' : 'plain_text',
    name: key,
    text: value,
  }));

  const metadata = JSON.stringify({
    main_module: 'index.js',
    compatibility_date: new Date().toISOString().slice(0, 10),
    compatibility_flags: ['nodejs_compat'],
    ...(bindings.length > 0 && { bindings }),
    keep_bindings: ['secret_text', 'plain_text'],
  });

  const formData = new FormData();

  formData.append('metadata', new Blob([metadata], { type: 'application/json' }), 'metadata.json');
  formData.append('index.js', new File([bundledContent], 'index.js', { type: 'application/javascript+module' }));

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    deploySpinner.fail('Failed to upload worker.');

    const body = await res.text();
    throw new Error(`Cloudflare API error: ${body}`);
  }

  const data = (await res.json()) as { result: { etag: string } };

  deploySpinner.succeed('Worker uploaded.');

  return { deploymentId: data.result.etag };
};
