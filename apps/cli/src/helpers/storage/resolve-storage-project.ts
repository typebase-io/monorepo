import { type getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { readPackageName } from '#helpers/storage/read-package-name.ts';
import { toBucketNamePart } from '#helpers/storage/to-bucket-name-part.ts';

export const resolveStorageProject = async (config: Awaited<ReturnType<typeof getTypebaseConfig>>): Promise<{ project: string; isNew: boolean }> => {
  if (config.storage?.project) {
    return { project: config.storage.project, isNew: false };
  }

  const serverNames = {
    vercel: config.vercel?.projectName,
    cloudflare: config.cloudflare?.workerName,
    deno: config.deno?.slug,
  };

  const candidates = [
    config.serverProvider ? serverNames[config.serverProvider] : undefined,
    serverNames.vercel,
    serverNames.cloudflare,
    serverNames.deno,
    await readPackageName(),
  ];

  const project = candidates.map((candidate) => (candidate ? toBucketNamePart(candidate) : undefined)).find(Boolean);

  if (!project) {
    throw new Error(
      'Could not choose a storage project name: there is no server config and `package.json` has no usable `name`. Set `storage.project` in typebase.json and sync again.'
    );
  }

  return { project, isNew: true };
};
