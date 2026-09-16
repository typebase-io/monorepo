import { type ChildProcess } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';
import { type Browser, chromium } from 'playwright';

import { captureSite } from '#helpers/compare-docs/capture-site.ts';
import { compareDiagnostics } from '#helpers/compare-docs/compare-diagnostics.ts';
import { compareImages } from '#helpers/compare-docs/compare-images.ts';
import { countDistinctChanges } from '#helpers/compare-docs/count-distinct-changes.ts';
import { discoverRoutes } from '#helpers/compare-docs/discover-routes.ts';
import { prepareWorktrees } from '#helpers/compare-docs/prepare-worktrees.ts';
import { runGitCommand } from '#helpers/compare-docs/run-git-command.ts';
import { startSite } from '#helpers/compare-docs/start-site.ts';
import { stopChild } from '#helpers/compare-docs/stop-child.ts';
import { type CaptureData, type ComparisonRequest, type Report, type RunningSite, type Side } from '#helpers/compare-docs/types.ts';
import { writeReport } from '#helpers/compare-docs/write-report.ts';

export const runComparison = async (request: ComparisonRequest): Promise<number> => {
  const { branch, options, threshold } = request;
  const external = !!request.baseUrl;
  const root = external ? process.cwd() : runGitCommand(process.cwd(), 'rev-parse', '--show-toplevel');
  const sides: Side[] = ['base', 'candidate'];

  const output = path.resolve(
    request.output ?? path.join(root, '.artifacts/compare-docs', new Date().toISOString().replaceAll(':', '-') + `-${process.pid}`)
  );

  try {
    await stat(output);

    throw new Error(`Output directory already exists: ${output}. Choose a new path to keep runs isolated.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(output, { recursive: true });

  const report: Report = {
    started: options.clock,
    complete: false,
    threshold,
    options,
    checks: [],
    comparisons: [],
    diagnostics: [],
    coverage: {},
    output,
  };

  const data: Record<Side, CaptureData> = {
    base: { screenshots: [], diagnostics: [], coverage: [] },
    candidate: { screenshots: [], diagnostics: [], coverage: [] },
  };

  const children = new Set<ChildProcess>();
  const worktrees: string[] = [];
  const running: Partial<Record<Side, RunningSite>> = {};

  let browser: Browser | undefined;
  let stopping = false;

  const isStopping = () => stopping;

  const signal = () => {
    if (stopping) return;

    stopping = true;

    console.warn(chalk.yellow(`Stopping comparison; completed captures and logs remain in ${output}`));

    for (const child of children) stopChild(child);

    browser?.close().catch(() => undefined);
  };

  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);

  try {
    browser = await chromium.launch({ headless: true, handleSIGINT: false, handleSIGTERM: false });

    if (request.baseUrl && request.candidateUrl) {
      running.base = { label: request.base, origin: request.baseUrl };
      running.candidate = { label: branch ?? 'candidate', origin: request.candidateUrl };
      report.base = running.base;
      report.candidate = running.candidate;
    } else {
      const revisions = await prepareWorktrees(root, request.base, branch ?? '', request.keepCheckout, (directory) => worktrees.push(directory));

      report.base = revisions.base;
      report.candidate = revisions.candidate;

      console.log(`Comparing ${revisions.base.commit.slice(0, 12)} → ${revisions.candidate.commit.slice(0, 12)}`);

      for (const side of sides) {
        if (isStopping()) throw new Error('Interrupted.');

        const site = await startSite(revisions[side], side, output, children, report.checks, isStopping);

        running[side] = site;
        report[side] = site;
      }
    }

    const { base, candidate } = running;

    if (!base || !candidate) throw new Error('Both revisions must be serving before capture can start.');

    const routeLists = {
      base: request.pages ?? (await discoverRoutes(base.origin)),
      candidate: request.pages ?? (await discoverRoutes(candidate.origin)),
    };

    report.routes = routeLists;
    report.routeChanges = {
      added: routeLists.candidate.filter((route) => !routeLists.base.includes(route)),
      removed: routeLists.base.filter((route) => !routeLists.candidate.includes(route)),
    };

    const routes = [...new Set([...routeLists.base, ...routeLists.candidate])].sort();

    console.log(
      `Capturing ${routes.length} routes × ${options.profiles.length} profiles × ${options.themes.length} themes on each revision. ` +
        'Every control is included; large sites can take a while.'
    );

    for (const side of sides) {
      if (isStopping()) throw new Error('Interrupted.');

      await captureSite(browser, { base, candidate }[side], side, routes, output, options, data[side]);
    }

    report.complete = true;
  } catch (error) {
    report.error = error instanceof Error ? (error.stack ?? error.message) : String(error);

    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  } finally {
    await browser?.close().catch(() => undefined);

    for (const child of children) stopChild(child);

    await Promise.all(
      [...children]
        .filter((child) => child.exitCode === null && child.signalCode === null)
        .map(
          (child) =>
            new Promise((done) => {
              child.once('exit', done);
            })
        )
    );

    for (const directory of worktrees) {
      if (request.keepWorktrees) {
        console.log(`Kept worktree: ${directory}`);

        continue;
      }

      try {
        runGitCommand(root, 'worktree', 'remove', directory);
      } catch {
        console.warn(chalk.yellow(`Retained worktree because Git refused a normal removal: ${directory}`));
      }
    }

    report.coverage = { base: data.base.coverage, candidate: data.candidate.coverage };
    report.diagnostics = compareDiagnostics(data.base.diagnostics, data.candidate.diagnostics);

    try {
      report.comparisons = await compareImages(data.base.screenshots, data.candidate.screenshots, output, threshold);
    } catch (error) {
      report.complete = false;
      report.error = (report.error ?? '') + '\nImage comparison failed: ' + (error instanceof Error ? error.message : String(error));
    }

    const coverageFailure = [...data.base.diagnostics, ...data.candidate.diagnostics].some((entry) =>
      ['capture-failed', 'hover-failed', 'coverage-limit', 'unverified-disclosure', 'accessibility-check-failed'].includes(entry.type)
    );

    if (coverageFailure || isStopping()) report.complete = false;

    report.finished = new Date().toISOString();

    await writeReport(output, report);

    process.removeListener('SIGINT', signal);
    process.removeListener('SIGTERM', signal);
  }

  const changed = report.comparisons.filter((entry) => entry.status !== 'identical').length;
  const newFindings = report.diagnostics.filter((entry) => entry.status === 'new').length;

  console.log(
    `\n${changed}/${report.comparisons.length} captures differ, in ${countDistinctChanges(report.comparisons)} distinct ways; ${newFindings} new findings.`
  );
  console.log(chalk.green(`Report: ${path.join(output, 'index.html')}`));
  console.log('Open index.html directly in your browser; the report does not require a server.');

  if (!report.complete) return 2;

  const differs =
    changed > 0 ||
    (report.routeChanges?.added.length ?? 0) > 0 ||
    (report.routeChanges?.removed.length ?? 0) > 0 ||
    newFindings > 0 ||
    report.checks.some((check) => check.status === 'failed');

  return differs ? 1 : 0;
};
