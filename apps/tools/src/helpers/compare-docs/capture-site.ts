import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { type Browser } from 'playwright';

import { openCaptureSession } from '#helpers/compare-docs/open-capture-session.ts';
import {
  type CaptureData,
  type CaptureOptions,
  type CaptureSession,
  type ProfileName,
  type Sighting,
  type Theme,
} from '#helpers/compare-docs/types.ts';

interface Job {
  theme: Theme;
  profileName: ProfileName;
  route: string;
}

export const captureSite = async (
  browser: Browser,
  site: { origin: string },
  side: string,
  routes: string[],
  output: string,
  options: CaptureOptions,
  data: CaptureData
) => {
  await mkdir(path.join(output, side), { recursive: true });

  let checkpoint = Promise.resolve();
  let checkpointedAt = 0;

  const writeCheckpoint = (force = false) => {
    if (!force && Date.now() - checkpointedAt < 10_000) {
      return checkpoint;
    }

    checkpointedAt = Date.now();
    checkpoint = checkpoint.then(() => {
      return writeFile(path.join(output, `${side}.json`), JSON.stringify(data, null, 2));
    });

    return checkpoint;
  };

  const rank = (sighting: Sighting) => {
    return JSON.stringify([sighting.route, String(sighting.trail.length).padStart(4, '0'), sighting.trail]);
  };

  const drain = async <T extends Job>(jobs: T[], handle: (session: CaptureSession, job: T) => Promise<void>) => {
    let next = 0;

    const worker = async () => {
      let session: CaptureSession | undefined;

      while (next < jobs.length) {
        const job = jobs[next++];

        if (!job) break;

        const key = `${job.profileName}-${job.theme}`;

        if (session?.key !== key) {
          await session?.close();
          session = await openCaptureSession({ browser, site, side, output, options, data, theme: job.theme, profileName: job.profileName });
        }

        await handle(session, job);
        await writeCheckpoint();
      }

      await session?.close();
    };

    await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency, jobs.length)) }, () => worker()));
  };

  const pageJobs = options.themes.flatMap((theme) => {
    return options.profiles.flatMap((profileName) => {
      return routes.map((route) => ({ theme, profileName, route }));
    });
  });

  const sightings: Sighting[] = [];

  await drain(pageJobs, async (session, job) => {
    sightings.push(...(await session.capturePage(job.route)));
  });

  const owners = new Map<string, Sighting>();

  for (const sighting of sightings) {
    const id = options.hoverDedup
      ? JSON.stringify([sighting.profile, sighting.key])
      : JSON.stringify([sighting.profile, rank(sighting), sighting.key]);

    const current = owners.get(id);

    if (!current || rank(sighting) < rank(current)) {
      owners.set(id, sighting);
    }
  }

  const owned = new Set(owners.values());

  for (const sighting of sightings) {
    if (!owned.has(sighting) && sighting.record.status === 'pending') sighting.record.status = 'covered-elsewhere';
  }

  const hoverJobs = new Map<string, Job & { sightings: Sighting[] }>();

  for (const sighting of owned) {
    const id = JSON.stringify([sighting.profileName, sighting.theme, sighting.route]);
    const existing = hoverJobs.get(id);

    if (existing) existing.sightings.push(sighting);
    else hoverJobs.set(id, { theme: sighting.theme, profileName: sighting.profileName, route: sighting.route, sightings: [sighting] });
  }

  const hoverList = [...hoverJobs.values()].sort((a, b) => {
    return JSON.stringify([`${a.profileName}-${a.theme}`, a.route]).localeCompare(JSON.stringify([`${b.profileName}-${b.theme}`, b.route]));
  });

  console.log(
    `[${side}] ${sightings.length} hoverable controls seen, ${owned.size} to hover` +
      (options.hoverDedup ? ` (${sightings.length - owned.size} already covered on another route)` : '')
  );

  await drain(hoverList, async (session, job) => {
    await session.captureHovers(job.route, job.sightings);
  });

  data.screenshots.sort((a, b) => {
    return a.key.localeCompare(b.key);
  });

  data.coverage.sort((a, b) => {
    return `${a.route} ${a.profile}`.localeCompare(`${b.route} ${b.profile}`);
  });

  data.diagnostics.sort((a, b) => {
    return `${a.route} ${a.profile} ${a.state} ${a.type} ${a.message}`.localeCompare(`${b.route} ${b.profile} ${b.state} ${b.type} ${b.message}`);
  });

  await writeCheckpoint(true);
};
