import { existsSync } from 'node:fs';
import path from 'node:path';

import chalk from 'chalk';
import ora from 'ora';
import { match } from 'ts-pattern';

import { type EnvTarget } from '#helpers/constants.ts';
import { getStorageProvider } from '#helpers/shared/get-storage-provider.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';
import { cloudflare } from '#helpers/storage/cloudflare/index.ts';
import { getDeclaredStorage } from '#helpers/storage/get-declared-storage.ts';
import { resolveStorageProject } from '#helpers/storage/resolve-storage-project.ts';
import { vercel } from '#helpers/storage/vercel/index.ts';

export const syncBuckets = async ({
  target,
  storageFilePath,
}: {
  target: EnvTarget;
  storageFilePath: string;
}): Promise<{ env: { key: string; value: string }[] }> => {
  if (!existsSync(storageFilePath)) {
    throw new Error(
      `There is no storage file at \`${path.relative(process.cwd(), storageFilePath)}\`. Declare your buckets with \`defineStorage\` there, then sync again.`
    );
  }

  const provider = getStorageProvider(storageFilePath);

  if (provider === 'filesystem' || provider === undefined) {
    console.log(`The filesystem storage provider keeps files on disk, so there are no buckets to create for ${target}.`);

    return { env: [] };
  }

  const declared = getDeclaredStorage(storageFilePath);
  const config = await getTypebaseConfig();
  const { project, isNew: isNewProject } = await resolveStorageProject(config);

  const { client, newAccount } = await match(provider)
    .with('vercel', () => vercel({ region: declared.region, config }))
    .with('cloudflare', () => cloudflare({ locationHint: declared.locationHint, config, project, target }))
    .exhaustive();

  const buckets = declared.buckets.map(({ bucket, access }) => ({ bucket, access, name: `${project}-${bucket}-${target}` }));
  const existing = new Map((await client.listBuckets()).map(({ name, access }) => [name, access]));

  for (const { bucket, access, name } of buckets) {
    const existingAccess = existing.get(name);

    if (existingAccess !== undefined && existingAccess !== access) {
      throw new Error(
        `The bucket \`${bucket}\` is declared ${access}, but \`${name}\` already exists on ${provider} as ${existingAccess}. A bucket's access cannot change once it exists: declare it ${existingAccess}, or delete \`${name}\` on ${provider} and sync again.`
      );
    }
  }

  if (isNewProject || newAccount) {
    await writeTypebaseConfig({ storage: { ...config.storage, ...(isNewProject ? { project } : {}), ...newAccount } });

    const saved = [...(isNewProject ? [`storage project "${project}"`] : []), ...(newAccount ? [`${provider} account`] : [])];

    ora().succeed(`Saved the ${saved.join(' and ')} to typebase.json.`);
  }

  const missing = buckets.filter(({ name }) => !existing.has(name));

  if (missing.length === 0) {
    console.log(`All buckets for ${target} already exist.`);
  } else {
    console.log(`Buckets to create for ${target}:\n${missing.map(({ name, access }) => `  ${name} (${access})`).join('\n')}`);

    for (const { name, access } of missing) {
      await client.createBucket({ name, access });
    }
  }

  const declaredNames = new Set(buckets.map(({ name }) => name));
  const orphans = [...existing.keys()].filter((name) => name.startsWith(`${project}-`) && name.endsWith(`-${target}`) && !declaredNames.has(name));

  for (const name of orphans) {
    console.log(chalk.yellow(`Warning: \`${name}\` exists on ${provider} for ${target} but storage.ts no longer declares it. It was left in place.`));
  }

  const publicBuckets = buckets.filter(({ access }) => access === 'public');

  if (provider === 'cloudflare' && target === 'prod' && publicBuckets.length > 0) {
    console.log(
      chalk.yellow(
        `Warning: public buckets are served from r2.dev, which is rate-limited and not meant for production. Connect a custom domain to ${publicBuckets.map(({ name }) => name).join(', ')} in the Cloudflare dashboard before you rely on it.`
      )
    );
  }

  const toEnvKey = (key: string) => (target === 'dev' ? `${key}_DEV` : key);
  const env = await client.getCredentials(buckets, (key) => readEnvVariable(toEnvKey(key)));

  for (const { key, value } of env) {
    const envKey = toEnvKey(key);

    await writeEnvFile(envKey, value);
    ora().succeed(`${envKey} written to .env.`);
  }

  return { env };
};
