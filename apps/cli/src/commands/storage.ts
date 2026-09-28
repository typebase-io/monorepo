import path from 'node:path';

import { Command, InvalidArgumentError } from '@commander-js/extra-typings';

import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { syncBuckets } from '#helpers/storage/sync-buckets.ts';

export const storage = new Command('storage').summary('Manage your storage buckets').addCommand(
  new Command('sync')
    .summary('Create the declared buckets for a target')
    .description(
      'Create every bucket declared in the storage file that does not exist yet for the target, and write the credentials for them into your local .env. Buckets are never deleted.'
    )
    .argument('<target>', 'Storage target (dev or prod)', (target) => {
      if (!['dev', 'prod'].includes(target)) {
        throw new InvalidArgumentError('Target must be "dev" or "prod".');
      }

      return target as 'dev' | 'prod';
    })
    .allowExcessArguments(false)
    .action(async (target) => {
      const { projectPath } = await getTypebaseConfig();

      await syncBuckets({ target, storageFilePath: path.resolve(projectPath, 'storage.ts') });
    })
);
