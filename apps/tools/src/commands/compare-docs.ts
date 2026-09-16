import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import chalk from 'chalk';

import { profiles } from '#helpers/compare-docs/profiles.ts';
import { recompareRun } from '#helpers/compare-docs/recompare-run.ts';
import { runComparison } from '#helpers/compare-docs/run-comparison.ts';
import { serveReport } from '#helpers/compare-docs/serve-report.ts';
import { type ProfileName, type Theme } from '#helpers/compare-docs/types.ts';

const themeNames: Theme[] = ['light', 'dark'];
const profileNames = Object.keys(profiles) as ProfileName[];

export const compareDocs = new Command('compare-docs')
  .summary('Compares the docs site between two Git revisions')
  .description(
    'Switches this checkout to the base branch, creates a detached worktree at the candidate commit, installs/lints/builds both, then screenshots every ' +
      'sitemap page — full page, the hover state of every control, and every menu — on desktop and mobile, in light and dark, and diffs the results.\n\n' +
      'Exit codes: 0 = no detected differences, 1 = differences or failed checks, 2 = an incomplete run or incomplete coverage. Pixel differences need ' +
      'human review; a visual change is not necessarily a regression.'
  )
  .argument('[branch]', 'Candidate branch to compare against the base branch')
  .option('-b, --base <branch>', 'Baseline branch', 'main')
  .option('--keep-checkout', 'Compare in two worktrees and leave this checkout untouched', false)
  .option('--keep-worktrees', 'Retain the created worktrees after the run', false)
  .option('--pages <routes>', 'Comma separated routes to capture; defaults to the union of both sitemaps', (value) => {
    return value.split(',').map((route) => {
      if (!route.startsWith('/') || route.startsWith('//') || route.includes('#') || route.includes('\\')) {
        throw new InvalidArgumentError('--pages must contain local absolute paths without fragments.');
      }

      return route;
    });
  })
  .addOption(new Option('--themes <themes...>').choices(themeNames).default(['dark'] as Theme[]))
  .addOption(new Option('--profiles <profiles...>').choices(profileNames).default(profileNames))
  .option(
    '--max-depth <depth>',
    'Maximum nested disclosure depth',
    (value) => {
      const depth = Number(value);

      if (!Number.isInteger(depth) || depth < 1) {
        throw new InvalidArgumentError('--max-depth must be a positive integer.');
      }

      return depth;
    },
    4
  )
  .option(
    '--threshold <threshold>',
    'Pixel color sensitivity between 0 and 1',
    (value) => {
      const threshold = Number(value);

      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        throw new InvalidArgumentError('--threshold must be between 0 and 1.');
      }

      return threshold;
    },
    0.1
  )
  .option(
    '--concurrency <workers>',
    'Pages captured at the same time; raise it to go faster, lower it if a loaded machine makes captures flaky',
    (value) => {
      const workers = Number(value);

      if (!Number.isInteger(workers) || workers < 1) {
        throw new InvalidArgumentError('--concurrency must be a positive integer.');
      }

      return workers;
    },
    4
  )
  .option('--no-hover-dedup', 'Hover every control on every route instead of once per theme and profile')
  .option('--no-axe', 'Skip the accessibility scans of default page states')
  .option('-o, --output <directory>', 'Artifact directory; it must not already exist')
  .option('--base-url <url>', 'Compare servers you already started; skips Git, install, lint and build', (value) => {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new InvalidArgumentError('Existing-server URLs must be localhost HTTP(S) origins, without paths, credentials, queries or fragments.');
    }

    return url.origin;
  })
  .option('--candidate-url <url>', 'Candidate server to compare against --base-url', (value) => {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new InvalidArgumentError('Existing-server URLs must be localhost HTTP(S) origins, without paths, credentials, queries or fragments.');
    }

    return url.origin;
  })
  .option('--recompare <directory>', 'Re-diff the screenshots of an existing run directory and rewrite its report, without capturing anything')
  .option('--serve <directory>', 'Serve an existing report directory over localhost instead of comparing')
  .option(
    '--port <port>',
    'Port for --serve',
    (value) => {
      const port = Number(value);

      if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new InvalidArgumentError('--port must be a valid port number.');
      }

      return port;
    },
    4173
  )
  .allowExcessArguments(false)
  .action(async (branch, options) => {
    try {
      if (options.serve) {
        console.log(chalk.green(`Report: ${await serveReport(options.serve, options.port)}`));
        console.log('Press Ctrl+C to stop serving.');

        await new Promise<void>((resolve) => {
          process.once('SIGINT', () => {
            resolve();
          });
          process.once('SIGTERM', () => {
            resolve();
          });
        });

        return;
      }

      const captureOptions = {
        themes: options.themes,
        profiles: options.profiles,
        maxDepth: options.maxDepth,
        axe: options.axe,
        clock: new Date().toISOString(),
        concurrency: options.concurrency,
        hoverDedup: options.hoverDedup,
      };

      if (options.recompare) {
        if (branch ?? options.baseUrl ?? options.candidateUrl) {
          throw new Error('--recompare re-diffs an existing run on its own; drop the branch and the --base-url/--candidate-url pair.');
        }

        process.exitCode = await recompareRun({ directory: options.recompare, threshold: options.threshold, options: captureOptions });

        return;
      }

      const external = !!(options.baseUrl ?? options.candidateUrl);

      if (external && !(options.baseUrl && options.candidateUrl)) {
        throw new Error('Supply both --base-url and --candidate-url.');
      }

      if (!external && !branch) {
        throw new Error('Supply exactly one candidate branch, or a pair of --base-url/--candidate-url servers.');
      }

      process.exitCode = await runComparison({
        branch,
        base: options.base,
        keepCheckout: options.keepCheckout,
        keepWorktrees: options.keepWorktrees,
        pages: options.pages,
        threshold: options.threshold,
        output: options.output,
        baseUrl: options.baseUrl,
        candidateUrl: options.candidateUrl,
        options: captureOptions,
      });
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));

      process.exitCode = 2;
    }
  });
