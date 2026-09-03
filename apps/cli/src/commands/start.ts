import path from 'node:path';

import { Command, Option } from '@commander-js/extra-typings';
import chalk from 'chalk';
import ora from 'ora';

import { getAndSaveAuthSecret } from '#helpers/auth/get-and-save-auth-secret.ts';
import { serverOutputs } from '#helpers/constants.ts';
import { applyMigrations } from '#helpers/db/apply-migrations.ts';
import { buildSchema } from '#helpers/db/build-schema.ts';
import { detectDrift } from '#helpers/db/detect-drift.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { buildServer } from '#helpers/generate-server/build-server.ts';
import { runServerCommand } from '#helpers/generate-server/run-server-command.ts';
import { watchServer } from '#helpers/generate-server/watch-server.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasMigrations } from '#helpers/shared/has-migrations.ts';
import { hashDirectory } from '#helpers/shared/hash-directory.ts';
import { hashFile } from '#helpers/shared/hash-file.ts';
import { parsePort } from '#helpers/shared/parse-port.ts';
import { type RunPrompt, runUntilStopped } from '#helpers/shared/run-until-stopped.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';
import { installServerDependencies } from '#helpers/start/install-server-dependencies.ts';
import { isPortAvailable } from '#helpers/start/is-port-available.ts';
import { pruneAbandonedServerCaches } from '#helpers/start/prune-abandoned-server-caches.ts';
import { resolveDatabaseUrl } from '#helpers/start/resolve-database-url.ts';
import { resolveServerCache } from '#helpers/start/resolve-server-cache.ts';
import { resolveServerOutput } from '#helpers/start/resolve-server-output.ts';

export const start = new Command('start')
  .summary('Run your Typebase server locally')
  .description('Build your Typebase server and run it locally. Press "x" or Ctrl+C to stop.')
  .allowExcessArguments(false)
  .addOption(new Option('--output <type>', 'Run TypeScript, CommonJS or ESM server files instead of choosing for this Node').choices(serverOutputs))
  .addOption(
    new Option('--database-url <url>', 'Run against this database URL (defaults to DATABASE_URL_LOCAL in the project env file)').conflicts([
      'devDatabase',
      'prodDatabase',
    ])
  )
  .addOption(
    new Option('--dev-database', 'Run against your dev database, the DATABASE_URL_DEV in the project env file').conflicts([
      'databaseUrl',
      'prodDatabase',
    ])
  )
  .addOption(
    new Option('--prod-database', 'Run against your production database, the DATABASE_URL in the project env file').conflicts([
      'databaseUrl',
      'devDatabase',
    ])
  )
  .option('--skip-schema-changes-confirmation', 'Apply destructive database schema changes without asking. They are still reported.')
  .option('--command <command>', 'Command to run in the server cache instead of starting the server directly')
  .option('--install-command <command>', "Command to install the server dependencies with, instead of your package manager's own")
  .option('--port <number>', 'Port the server listens on', parsePort)
  .action(async (params) => {
    const { projectPath, server } = await getTypebaseConfig();

    const typebaseDirPath = path.resolve(projectPath);
    const dbDirPath = path.join(typebaseDirPath, 'db');
    const migrationsDirPath = path.join(dbDirPath, 'migrations');
    const schemaFilePath = path.join(dbDirPath, 'schema.ts');
    const port = params.port ?? server.port;
    const portAvailable = await isPortAvailable(port);

    const database = resolveDatabaseUrl({
      databaseUrl: params.databaseUrl,
      devDatabase: params.devDatabase,
      prodDatabase: params.prodDatabase,
      schemaFilePath,
    });

    if (!portAvailable) {
      throw new Error(`Port ${port} is already in use. Pass a different one with --port.`);
    }

    if (database) {
      ora().info(`Using the database from ${database.source}.`);
    }

    const { output, warnAboutTranspiling } = resolveServerOutput(params.output);

    if (warnAboutTranspiling) {
      ora().warn(
        `The Node version you are using cannot run TypeScript so the server is going to get transpiled before it starts. Node 22.18 or newer skips this step.`
      );
    }

    if (hasAuth(path.join(typebaseDirPath, 'auth.ts'))) {
      await getAndSaveAuthSecret();
    }

    await writeEnvFile('TYPEBASE_APP_URL_LOCAL', `http://127.0.0.1:${port}`);

    await pruneAbandonedServerCaches();

    const { cacheDirPath, serverDirPath } = await resolveServerCache(typebaseDirPath);

    const syncDatabase = async (connectionUri: string, prompt: RunPrompt) => {
      if (hasMigrations(migrationsDirPath)) {
        const { tables } = await detectDrift({ dbDirPath, migrationsDirPath, serverProvider: undefined });

        if (tables.length > 0) {
          ora().warn(`Your schema files have changes that no migration records, affecting ${tables.join(', ')}.`);

          console.log(
            chalk.yellow('Run `db migrations generate` to record them. Applying now brings this database up to the last recorded migration only.\n')
          );
        }

        const { applied } = await applyMigrations({ migrationsDirPath, connectionUri });

        ora().succeed(
          applied.length === 0
            ? 'Database is up to date. No migrations to apply.'
            : `${applied.length} ${applied.length === 1 ? 'migration' : 'migrations'} applied.`
        );
      } else {
        const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: undefined });

        try {
          await pushSchema({
            serverDistDirPath,
            connectionUri,
            skipConfirmation: params.skipSchemaChangesConfirmation ?? false,
            prompt,
          });
        } finally {
          await cleanup();
        }
      }

      await writeEnvFile('DATABASE_URL', connectionUri, path.join(serverDirPath, '.env'));
    };

    let installedManifestHash: string | undefined;
    let syncedDatabaseHash: string | undefined;
    let firstPassError: Error | undefined;

    await runUntilStopped(async (signal, prompt) => {
      const serverProcess = params.command
        ? runServerCommand({ command: params.command, cwd: serverDirPath })
        : runServerCommand({ command: process.execPath, args: [path.join('src', output === 'ts' ? 'index.ts' : 'index.js')], cwd: serverDirPath });

      const run = new AbortController();

      const stopRun = () => {
        run.abort();
      };

      if (signal.aborted) {
        stopRun();
      } else {
        signal.addEventListener('abort', stopRun, { once: true });
      }

      const installIfManifestChanged = async (rebuild: boolean): Promise<boolean> => {
        const manifestHash = await hashFile(path.join(serverDirPath, 'package.json'));

        if (manifestHash === installedManifestHash) {
          return true;
        }

        try {
          await installServerDependencies({ dirPath: serverDirPath, command: params.installCommand });
        } catch (err) {
          if (rebuild) {
            throw err;
          }

          firstPassError = err instanceof Error ? err : new Error(String(err));

          stopRun();

          return false;
        }

        installedManifestHash = manifestHash;

        return true;
      };

      const syncDatabaseIfChanged = async (prompt: RunPrompt) => {
        if (!database) {
          return;
        }

        const databaseHash = await hashDirectory(dbDirPath);

        if (databaseHash === syncedDatabaseHash) {
          return;
        }

        await syncDatabase(database.url, prompt);

        syncedDatabaseHash = databaseHash;
      };

      const build = async (buildSignal: AbortSignal, { rebuild }: { rebuild: boolean }) => {
        const cancelled = () => buildSignal.aborted;

        if (rebuild) {
          console.clear();
        }

        const spinner = rebuild ? ora('Rebuilding...').start() : undefined;

        try {
          try {
            await buildServer({
              projectPath,
              output,
              adapter: 'node',
              outDir: serverDirPath,
              configuredOutDir: server.outDir,
              port,
              authBaseURL: `http://127.0.0.1:${port}`,
              signal: buildSignal,
              quiet: rebuild,
            });
          } finally {
            spinner?.stop();
          }

          if (!(await installIfManifestChanged(rebuild)) || cancelled()) {
            return;
          }

          await syncDatabaseIfChanged(prompt);

          if (cancelled()) {
            return;
          }

          await serverProcess.restart();

          if (rebuild) {
            ora().succeed('Server restarted!');
          }
        } catch (err) {
          if (run.signal.aborted) {
            return;
          }

          throw err;
        }
      };

      try {
        await watchServer({
          build,
          dirPath: typebaseDirPath,
          ignoredDirPaths: [cacheDirPath, path.join(typebaseDirPath, '_generated')],
          signal: run.signal,
        });
      } finally {
        signal.removeEventListener('abort', stopRun);

        await serverProcess.stop();
      }
    });

    if (firstPassError !== undefined) {
      throw firstPassError;
    }
  });
