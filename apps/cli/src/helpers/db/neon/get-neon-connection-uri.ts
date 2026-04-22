import { createApiClient } from '@neondatabase/api-client';
import ora from 'ora';

import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';

export const getNeonConnectionUri = async ({
  token,
  projectId,
  branchId,
  target,
}: {
  token: string;
  projectId: string;
  branchId: string;
  target: 'dev' | 'prod';
}): Promise<string> => {
  const key = target === 'prod' ? 'DATABASE_URL' : 'DATABASE_URL_DEV';
  const envUri = readEnvVariable(key);

  if (envUri) {
    return envUri;
  }

  const apiClient = createApiClient({ apiKey: token });

  const spinner = ora('Fetching connection URI...').start();

  const uriRes = await apiClient.getConnectionUri({
    projectId,
    branch_id: branchId,
    database_name: 'neondb',
    role_name: 'neondb_owner',
  });

  const connectionUrl = new URL(uriRes.data.uri);
  connectionUrl.searchParams.set('sslmode', 'verify-full');

  const connectionUri = connectionUrl.toString();

  spinner.stop();

  await writeEnvFile(key, connectionUri);

  ora().succeed(`${key} saved to .env.`);

  return connectionUri;
};
