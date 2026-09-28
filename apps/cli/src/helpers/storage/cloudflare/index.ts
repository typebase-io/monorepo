import { createHash } from 'node:crypto';

import {
  type EnvTarget,
  R2_ACCESS_KEY_ID_ENV_KEY,
  R2_ACCOUNT_ID_ENV_KEY,
  R2_BUCKETS_ENV_KEY,
  R2_SECRET_ACCESS_KEY_ENV_KEY,
} from '#helpers/constants.ts';
import { CloudflareClient, type CloudflareTokenPolicy } from '#helpers/deploy/cloudflare/client.ts';
import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getR2PublicUrlEnvKey } from '#helpers/shared/get-r2-public-url-env-key.ts';
import { type getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { getCloudflareStorageAccount } from '#helpers/storage/cloudflare/get-cloudflare-storage-account.ts';
import { type StorageProviderClient } from '#helpers/storage/storage-provider-client.ts';

const R2_PERMISSION_GROUPS = ['Workers R2 Storage Bucket Item Write', 'Workers R2 Storage Bucket Item Read'];

export const cloudflare = async ({
  locationHint,
  config,
  project,
  target,
}: {
  locationHint: string | undefined;
  config: Awaited<ReturnType<typeof getTypebaseConfig>>;
  project: string;
  target: EnvTarget;
}): Promise<{ client: StorageProviderClient; newAccount: { cloudflare: { accountId: string } } | undefined }> => {
  const token = await getCloudflareToken();
  const { accountId, isNew } = await getCloudflareStorageAccount({ token, config });
  const client = new CloudflareClient({ token, accountId });
  const publicDomains = new Map<string, string>();

  const storageClient: StorageProviderClient = {
    listBuckets: async () => {
      const names = (await client.listR2Buckets()).filter((name) => name.startsWith(`${project}-`) && name.endsWith(`-${target}`));

      return Promise.all(
        names.map(async (name) => {
          const { domain, enabled } = await client.getR2ManagedDomain({ name });

          if (enabled) {
            publicDomains.set(name, domain);
          }

          return { name, access: enabled ? ('public' as const) : ('private' as const) };
        })
      );
    },
    createBucket: async ({ name, access }) => {
      await client.createR2Bucket({ name, locationHint });

      if (access === 'public') {
        const { domain } = await client.enableR2ManagedDomain({ name });

        publicDomains.set(name, domain);
      }
    },
    getCredentials: async (buckets, stored) => {
      const tokenName = `typebase-storage-${project}-${target}`;
      const resources = Object.fromEntries(buckets.map(({ name }) => [`com.cloudflare.edge.r2.bucket.${accountId}_default_${name}`, '*']));
      const policies = async (): Promise<CloudflareTokenPolicy[]> => [
        {
          effect: 'allow',
          permission_groups: (await client.getPermissionGroupIds(R2_PERMISSION_GROUPS)).map((id) => ({ id })),
          resources,
        },
      ];

      const storedId = stored(R2_ACCESS_KEY_ID_ENV_KEY);
      const storedSecret = stored(R2_SECRET_ACCESS_KEY_ENV_KEY);
      const existing = storedId && storedSecret ? await client.getAccountToken({ id: storedId }) : undefined;

      let keys: { accessKeyId: string; secretAccessKey: string };

      if (existing && storedSecret) {
        const current = new Set(existing.policies.flatMap((policy) => Object.keys(policy.resources)));
        const covered = current.size === Object.keys(resources).length && Object.keys(resources).every((resource) => current.has(resource));

        if (!covered) {
          await client.updateAccountToken({ id: existing.id, name: existing.name, policies: await policies() });
        }

        keys = { accessKeyId: existing.id, secretAccessKey: storedSecret };
      } else {
        const created = await client.createAccountToken({ name: tokenName, policies: await policies() });

        keys = { accessKeyId: created.id, secretAccessKey: createHash('sha256').update(created.value).digest('hex') };
      }

      const publicUrls = buckets
        .filter(({ access }) => access === 'public')
        .map(({ bucket, name }) => {
          const domain = publicDomains.get(name);

          if (!domain) {
            throw new Error(`The R2 bucket \`${name}\` for the public bucket \`${bucket}\` has no r2.dev domain on Cloudflare.`);
          }

          return { key: getR2PublicUrlEnvKey(bucket), value: `https://${domain}` };
        });

      return [
        { key: R2_ACCOUNT_ID_ENV_KEY, value: accountId },
        { key: R2_ACCESS_KEY_ID_ENV_KEY, value: keys.accessKeyId },
        { key: R2_SECRET_ACCESS_KEY_ENV_KEY, value: keys.secretAccessKey },
        { key: R2_BUCKETS_ENV_KEY, value: JSON.stringify(Object.fromEntries(buckets.map(({ bucket, name }) => [bucket, name]))) },
        ...publicUrls,
      ];
    },
  };

  return { client: storageClient, newAccount: isNew ? { cloudflare: { accountId } } : undefined };
};
