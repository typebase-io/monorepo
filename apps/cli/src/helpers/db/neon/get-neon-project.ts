import path from 'node:path';

import { input, select } from '@inquirer/prompts';
import { createApiClient } from '@neondatabase/api-client';
import ora from 'ora';
import { match } from 'ts-pattern';

import { getNeonOrganization } from '#helpers/db/neon/get-neon-organization.ts';
import { waitForDeployment } from '#helpers/db/neon/wait-for-deployment.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

export const getNeonProject = async (token: string) => {
  const config = await getTypebaseConfig();

  if (config.neon) {
    return {
      orgId: config.neon.orgId,
      projectId: config.neon.projectId,
    };
  }

  const apiClient = createApiClient({ apiKey: token });
  const orgId = await getNeonOrganization(apiClient);

  const projectsSpinner = ora('Fetching Neon projects...').start();

  const projectsRes = await apiClient.listProjects(orgId ? { org_id: orgId } : {});
  const projects = projectsRes.data.projects;

  projectsSpinner.stop();

  const selectedProject =
    projects.length === 0
      ? '__create_new__'
      : await select({
          message: 'Select a Neon project:',
          choices: [
            {
              name: '+ Create a new Neon project',
              value: '__create_new__',
            },
            ...projects.map((project) => ({
              name: project.name,
              value: project.id,
            })),
          ],
        });

  const result = await match(selectedProject)
    .with('__create_new__', async () => {
      const name = await input({
        message: 'Neon project name:',
        default: path.basename(process.cwd()),
        prefill: 'editable',
        required: true,
        validate: (val) => val.trim() !== '',
      });

      const regionId = await select({
        message: 'Select a Neon region:',
        choices: [
          { name: 'US East (Ohio)', value: 'aws-us-east-2' },
          { name: 'US East (N. Virginia)', value: 'aws-us-east-1' },
          { name: 'US West (Oregon)', value: 'aws-us-west-2' },
          { name: 'Europe (Frankfurt)', value: 'aws-eu-central-1' },
          { name: 'Asia Pacific (Singapore)', value: 'aws-ap-southeast-1' },
          { name: 'Asia Pacific (Sydney)', value: 'aws-ap-southeast-2' },
        ],
      });

      const createSpinner = ora(`Creating Neon project "${name}"...`).start();

      const createRes = await apiClient.createProject({
        project: {
          name,
          org_id: orgId,
          region_id: regionId,
        },
      });

      const projectId = createRes.data.project.id;

      await waitForDeployment({ apiClient, projectId, operations: createRes.data.operations });

      createSpinner.succeed(`Neon project "${name}" created.`);

      return { orgId, projectId };
    })
    .otherwise((projectId) => {
      return { orgId, projectId };
    });

  await writeTypebaseConfig({ neon: { orgId: result.orgId, projectId: result.projectId } });

  ora().succeed('Config saved to typebase.json.');

  return result;
};
