import { VERCEL_STORAGE_TOKENS_ENV_KEY } from '#helpers/constants.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';
import { type getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { type StorageProviderClient } from '#helpers/storage/storage-provider-client.ts';
import { getVercelStorageTeam } from '#helpers/storage/vercel/get-vercel-storage-team.ts';

export const vercel = async ({
  region,
  config,
}: {
  region: string | undefined;
  config: Awaited<ReturnType<typeof getTypebaseConfig>>;
}): Promise<{ client: StorageProviderClient; newAccount: { vercel: { orgId: string } } | undefined }> => {
  const token = await getVercelToken();
  const { orgId, isNew } = await getVercelStorageTeam({ token, config });
  const client = new VercelClient({ token, orgId });
  const storeIds = new Map<string, string>();

  const storageClient: StorageProviderClient = {
    listBuckets: async () => {
      const stores = await client.listStores();

      for (const { id, name } of stores) {
        storeIds.set(name, id);
      }

      return stores;
    },
    createBucket: async ({ name, access }) => {
      const store = await client.createStore({ name, access, region });

      storeIds.set(name, store.id);
    },
    getCredentials: async (buckets) => {
      const tokens = await Promise.all(
        buckets.map(async ({ bucket, name }) => {
          const id = storeIds.get(name);

          if (!id) {
            throw new Error(`The Blob store \`${name}\` for the bucket \`${bucket}\` was not found on Vercel.`);
          }

          return [bucket, await client.getStoreToken({ id })] as const;
        })
      );

      return [{ key: VERCEL_STORAGE_TOKENS_ENV_KEY, value: JSON.stringify(Object.fromEntries(tokens)) }];
    },
  };

  return { client: storageClient, newAccount: isNew ? { vercel: { orgId } } : undefined };
};
