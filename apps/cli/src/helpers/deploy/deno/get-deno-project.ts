import path from 'node:path';

import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { match } from 'ts-pattern';

import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

export const getDenoProject = async (token: string) => {
  const config = await getTypebaseConfig();

  if (config.deno) {
    return {
      org: config.deno.org,
      projectId: config.deno.projectId,
      slug: config.deno.slug,
    };
  }

  const org = await input({
    message: 'Deno Deploy organization slug (visible at console.deno.com):',
    required: true,
    validate: (val) => val.trim() !== '',
  });

  const getAppsSpinner = ora('Fetching Deno Deploy apps...').start();

  const allProjects: { id: string; slug: string }[] = [];
  let cursor: string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const url = new URL(`https://api.deno.com/v2/apps`);

    url.searchParams.set('limit', '100');

    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) {
      getAppsSpinner.fail('Failed to fetch apps.');

      const body = await res.text();
      throw new Error(`Failed to fetch Deno Deploy apps: ${body}`);
    }

    const apps = (await res.json()) as { id: string; slug: string }[];

    allProjects.push(...apps.map(({ id, slug }) => ({ id, slug })));

    const linkHeader = res.headers.get('link');
    const nextMatch = linkHeader?.match(/<[^>]*[?&]cursor=([^&>]+)[^>]*>;\s*rel="next"/);

    if (!nextMatch || apps.length === 0) {
      break;
    }

    cursor = nextMatch[1];
  }

  getAppsSpinner.stop();

  const selectedApp = await select({
    message: 'Select an app to deploy to:',
    choices: [
      {
        name: '+ Create a new app',
        value: '__create_new__',
      },
      ...allProjects.map((app) => ({
        name: app.slug,
        value: app.id,
      })),
    ],
  });

  const app = await match(selectedApp)
    .with('__create_new__', async () => {
      const slug = await input({
        message: 'App slug:',
        default: path.basename(process.cwd()),
        prefill: 'editable',
        required: true,
        validate: (val) => val.trim() !== '',
      });

      const spinner = ora(`Creating Deno Deploy app "${slug}"...`).start();

      const res = await fetch(`https://api.deno.com/v2/apps`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug }),
      });

      if (!res.ok) {
        spinner.fail('Failed to create app.');
        const body = await res.text();
        throw new Error(`Failed to create Deno Deploy app: ${body}`);
      }

      const created = (await res.json()) as { id: string; slug: string };

      spinner.succeed(`App "${slug}" created.`);

      return { org, projectId: created.id, slug: created.slug };
    })
    .otherwise((value) => {
      const selected = allProjects.find(({ id }) => id === value);

      if (!selected) {
        return undefined;
      }

      return { org, projectId: selected.id, slug: selected.slug };
    });

  if (!app) {
    console.error(chalk.red('Invalid option.'));
    process.exit(1);
  }

  await writeTypebaseConfig({ deno: { org: app.org, projectId: app.projectId, slug: app.slug } });
  ora().succeed('Config saved to typebase.json.');

  return app;
};
