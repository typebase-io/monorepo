import path from 'node:path';

import { confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { match } from 'ts-pattern';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

export const getVercelProject = async (token: string) => {
  const config = await getTypebaseConfig();

  if (config.vercel) {
    return {
      projectId: config.vercel.projectId,
      projectName: config.vercel.projectName,
      orgId: config.vercel.orgId,
    };
  }

  const vercel = new VercelClient({ token, orgId: undefined });
  const getProjectsSpinner = ora('Fetching Vercel projects...').start();

  const projects = await vercel.getProjects();

  getProjectsSpinner.stop();

  const selectedProject =
    projects.length === 0
      ? '__create_new__'
      : await select({
          message: 'Select a project to deploy to:',
          choices: [
            {
              name: '+ Create a new project',
              value: '__create_new__',
            },
            ...projects.map((project) => ({
              name: project.name,
              value: project.id,
            })),
          ],
        });

  const project = await match(selectedProject)
    .with('__create_new__', async () => {
      const projectName = await input({
        message: 'Project name:',
        default: path.basename(process.cwd()),
        prefill: 'editable',
        required: true,
        validate: (val) => val.trim() !== '',
      });

      const spinner = ora(`Creating Vercel project "${projectName}"...`).start();

      const created = await vercel.createProject({
        name: projectName,
        framework: 'hono',
      });

      await vercel.removeProtectionsToProject({ id: created.id });

      spinner.succeed(`Project "${projectName}" created..`);

      return {
        projectId: created.id,
        projectName: created.name,
        orgId: created.accountId,
      };
    })
    .otherwise(async (value) => {
      const selectedProject = projects.find(({ id }) => id === value);

      if (!selectedProject) {
        return undefined;
      }

      if (selectedProject.ssoProtection || selectedProject.passwordProtection) {
        const disableProtections = await confirm({ message: 'Project is protected. Disabled protections?' });

        if (!disableProtections) {
          return undefined;
        }

        const spinner = ora('Updating project...').start();

        await vercel.removeProtectionsToProject({ id: selectedProject.id });

        spinner.stop();
      }

      return {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        orgId: selectedProject.accountId,
      };
    });

  if (!project) {
    console.error(chalk.red('Invalid option.'));
    process.exit(1);
  }

  await writeTypebaseConfig({ vercel: project });
  ora().succeed('Config saved to typebase.json.');

  return project;
};
