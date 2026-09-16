import { readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { compareDiagnostics } from '#helpers/compare-docs/compare-diagnostics.ts';
import { compareImages } from '#helpers/compare-docs/compare-images.ts';
import { countDistinctChanges } from '#helpers/compare-docs/count-distinct-changes.ts';
import { type CaptureData, type CaptureOptions, type Report } from '#helpers/compare-docs/types.ts';
import { writeReport } from '#helpers/compare-docs/write-report.ts';

export const recompareRun = async ({
  directory,
  threshold,
  options,
}: {
  directory: string;
  threshold: number;
  options: CaptureOptions;
}): Promise<number> => {
  const output = path.resolve(directory);

  try {
    await stat(output);
  } catch {
    throw new Error(`No such run directory: ${output}`);
  }

  const data: Record<'base' | 'candidate', CaptureData> = {
    base: { screenshots: [], diagnostics: [], coverage: [] },
    candidate: { screenshots: [], diagnostics: [], coverage: [] },
  };

  for (const side of ['base', 'candidate'] as const) {
    const file = path.join(output, `${side}.json`);

    try {
      data[side] = (await JSON.parse(await readFile(file, 'utf-8'))) as CaptureData;
    } catch {
      throw new Error(`Cannot read ${side}.json in ${output}. Point --recompare at a compare-docs run directory.`);
    }

    if (!Array.isArray(data[side].screenshots)) {
      throw new Error(`${file} does not hold a capture inventory. Point --recompare at a compare-docs run directory.`);
    }
  }

  let previous: Partial<Report> = {};

  try {
    previous = (await JSON.parse(await readFile(path.join(output, 'report.json'), 'utf-8'))) as Report;
  } catch {
    console.warn(chalk.yellow('No report.json in this run; rebuilding the report from the capture inventories alone.'));
  }

  const missing: string[] = [];

  for (const side of ['base', 'candidate'] as const) {
    for (const shot of data[side].screenshots) {
      try {
        await stat(path.join(output, shot.file));
      } catch {
        missing.push(shot.file);
      }
    }
  }

  if (missing.length) {
    throw new Error(`${missing.length} screenshots listed in the inventory are missing from disk, starting with ${missing[0]}.`);
  }

  const report: Report = {
    started: previous.started ?? new Date().toISOString(),
    complete: previous.complete ?? false,
    threshold,
    options: previous.options ?? options,
    checks: previous.checks ?? [],
    comparisons: [],
    diagnostics: compareDiagnostics(data.base.diagnostics, data.candidate.diagnostics),
    coverage: { base: data.base.coverage, candidate: data.candidate.coverage },
    output,
    base: previous.base,
    candidate: previous.candidate,
    routes: previous.routes,
    routeChanges: previous.routeChanges,
    error: previous.error,
  };

  console.log(
    `Re-diffing ${data.base.screenshots.length} base and ${data.candidate.screenshots.length} candidate captures in ${output} at threshold ${threshold}.`
  );

  report.comparisons = await compareImages(data.base.screenshots, data.candidate.screenshots, output, threshold);

  const keep = new Set(report.comparisons.map((entry) => entry.diff).filter((file) => file !== undefined));
  const stale = (await readdir(path.join(output, 'diff'))).filter((file) => !keep.has(`diff/${file}`));

  for (const file of stale) {
    await rm(path.join(output, 'diff', file), { force: true });
  }

  if (stale.length) {
    console.log(`Removed ${stale.length} diff images that this comparison no longer produces.`);
  }

  report.finished = new Date().toISOString();

  await writeReport(output, report);

  const changed = report.comparisons.filter((entry) => entry.status !== 'identical').length;
  const newFindings = report.diagnostics.filter((entry) => entry.status === 'new').length;

  console.log(
    `\n${changed}/${report.comparisons.length} captures differ, in ${countDistinctChanges(report.comparisons)} distinct ways; ${newFindings} new findings.`
  );
  console.log(chalk.green(`Report: ${path.join(output, 'index.html')}`));

  if (!report.complete) {
    console.warn(chalk.yellow('The original run was incomplete, so this report covers only what it managed to capture.'));

    return 2;
  }

  const differs =
    changed > 0 ||
    (report.routeChanges?.added.length ?? 0) > 0 ||
    (report.routeChanges?.removed.length ?? 0) > 0 ||
    newFindings > 0 ||
    report.checks.some((check) => check.status === 'failed');

  return differs ? 1 : 0;
};
