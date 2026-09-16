import { createHash } from 'node:crypto';
import path from 'node:path';

import { AxeBuilder } from '@axe-core/playwright';
import { type Browser } from 'playwright';

import { getInventory } from '#helpers/compare-docs/get-inventory.ts';
import { profiles } from '#helpers/compare-docs/profiles.ts';
import {
  type CaptureData,
  type CaptureOptions,
  type CaptureSession,
  type DiagnosticType,
  type DisclosureCoverage,
  type PageCoverage,
  type ProfileName,
  type ScreenshotKind,
  type Sighting,
  type Theme,
} from '#helpers/compare-docs/types.ts';

export const openCaptureSession = async ({
  browser,
  site,
  side,
  output,
  options,
  data,
  theme,
  profileName,
}: {
  browser: Browser;
  site: { origin: string };
  side: string;
  output: string;
  options: CaptureOptions;
  data: CaptureData;
  theme: Theme;
  profileName: ProfileName;
}): Promise<CaptureSession> => {
  const { screenshots, diagnostics, coverage } = data;
  const profile = profiles[profileName];
  const profileLabel = `${profileName}-${theme}`;
  const { hover, ...contextOptions } = profile;
  const normalize = (text: string) => text.replaceAll(site.origin, '<origin>');

  const context = await browser.newContext({
    ...contextOptions,
    deviceScaleFactor: 1,
    colorScheme: theme,
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });

  await context.addInitScript((color: string) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('theme', color);
  }, theme);

  await context.route(/\/_vercel\/(insights|speed-insights)\//, (route) => route.fulfill({ status: 204, body: '' }));

  const page = await context.newPage();

  page.setDefaultTimeout(4000);

  await page.clock.setFixedTime(new Date(options.clock));

  let routePath = '';
  let state = 'page';

  const issue = (type: DiagnosticType, message: string) => {
    diagnostics.push({ route: routePath, profile: profileLabel, state, type, message: normalize(message) });
  };

  page.on('pageerror', (error) => {
    issue('page-error', error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') issue('console-error', message.text());
  });

  page.on('response', (response) => {
    if (response.url().startsWith(site.origin + '/') && response.status() >= 400) issue('http-error', `${response.status()} ${response.url()}`);
  });

  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText ?? 'unknown';

    if (request.url().startsWith(site.origin + '/') && !error.includes('ERR_ABORTED')) issue('request-failed', `${request.url()} ${error}`);
  });

  page.on('dialog', (dialog) => {
    issue('unexpected-dialog', dialog.message());
    void dialog.dismiss();
  });

  page.on('popup', (popup) => {
    issue('unexpected-popup', popup.url());
    void popup.close();
  });

  const screenshot = async (kind: ScreenshotKind, identity: string, label: string, fullPage: boolean) => {
    const key = JSON.stringify([routePath, profileLabel, kind, identity]);
    const file = `${side}/${createHash('sha256').update(key).digest('hex').slice(0, 24)}.png`;

    await page.screenshot({ path: path.join(output, file), fullPage, animations: 'disabled', caret: 'hide', timeout: 30_000 });

    screenshots.push({ key, route: routePath, profile: profileLabel, kind, label, state, file });
  };

  const activate = async (key: string) => {
    const controls = await getInventory(page);
    const target = controls.find((control) => control.key === key);

    if (!target) {
      throw new Error(`Disclosure is missing or hidden: ${key}`);
    }

    const locator = page.locator(`[data-docs-compare-control="${target.index}"]`);
    const before = JSON.stringify(controls.map(({ key: controlKey, signature }) => [controlKey, signature]));
    const beforeUrl = page.url();

    if (profile.hasTouch) {
      await locator.tap();
    } else {
      await locator.click();
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    if (page.url() !== beforeUrl) {
      throw new Error(`Disclosure navigated to ${page.url()} instead of opening in place.`);
    }

    const after = JSON.stringify((await getInventory(page)).map(({ key: controlKey, signature }) => [controlKey, signature]));

    if (before === after) {
      issue('unverified-disclosure', `Activated ${target.label}, but no visible controls or disclosure state changed. Inspect its screenshot.`);
    }
  };

  const load = async () => {
    const response = await page.goto(new URL(routePath, site.origin).href, { waitUntil: 'networkidle', timeout: 45_000 });

    await page.addStyleTag({
      content:
        '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}',
    });

    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
        scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      scrollTo(0, 0);
    });

    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    return response;
  };

  const capturePage = async (route: string): Promise<Sighting[]> => {
    routePath = route;

    console.log(`[${side}] ${profileLabel} ${routePath}`);

    await context.clearCookies();

    const seen = new Set<string>();
    const explored = new Set<string>();
    const sightings: Sighting[] = [];
    const queue: { trail: string[]; label: string; disclosure?: DisclosureCoverage }[] = [{ trail: [], label: 'Page' }];

    const pageCoverage: PageCoverage = {
      route: routePath,
      profile: profileLabel,
      controls: [],
      disclosures: [],
      states: 0,
      hoverApplicable: hover,
    };

    coverage.push(pageCoverage);

    while (queue.length) {
      const current = queue.shift();

      if (!current) break;

      state = current.trail.length ? current.label : 'page';

      try {
        await page.mouse.move(0, 0);

        const response = await load();

        if (!response?.ok()) {
          issue('page-status', `Page returned ${response?.status() ?? 'no response'}`);
        }

        for (const key of current.trail) {
          await activate(key);
        }

        await screenshot('full-page', JSON.stringify(current.trail), current.label, true);

        if (current.trail.length) {
          await screenshot('open-viewport', JSON.stringify(current.trail), current.label, false);
        }

        pageCoverage.states++;

        if (!current.trail.length) {
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

          if (overflow) {
            issue('horizontal-overflow', 'The document is wider than the viewport.');
          }

          const brokenImages = await page
            .locator('img')
            .evaluateAll<
              (string | null)[],
              undefined,
              HTMLImageElement
            >((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));

          for (const image of brokenImages) {
            issue('broken-image', image ?? '(image without a src attribute)');
          }

          if (options.axe) {
            try {
              const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

              for (const violation of result.violations) {
                issue(
                  'accessibility',
                  `${violation.impact}: ${violation.id}: ${violation.help} (${violation.nodes.length} elements) ${violation.helpUrl}`
                );
              }
            } catch (error) {
              issue('accessibility-check-failed', error instanceof Error ? error.message : String(error));
            }
          }
        }

        const controls = await getInventory(page);

        for (const control of controls) {
          if (!control.trigger || control.disabled || explored.has(control.key) || current.trail.includes(control.key)) {
            continue;
          }

          explored.add(control.key);

          const disclosure: DisclosureCoverage = { key: control.key, label: control.label, trail: [...current.trail, control.key] };

          pageCoverage.disclosures.push(disclosure);

          if (current.trail.length >= options.maxDepth) {
            issue('coverage-limit', `Nested disclosure ${control.label} exceeds --max-depth ${options.maxDepth}.`);
            disclosure.status = 'depth-limit';
          } else {
            disclosure.status = 'queued';
            queue.push({ trail: disclosure.trail, label: `${current.label} → ${control.label}`, disclosure });
          }
        }

        for (const control of controls) {
          if (seen.has(control.key)) {
            continue;
          }

          seen.add(control.key);

          const record: PageCoverage['controls'][number] = {
            key: control.key,
            label: control.label,
            state,
            status: control.disabled ? 'disabled' : hover ? 'pending' : 'touch-no-hover',
          };

          pageCoverage.controls.push(record);

          if (control.disabled || !hover) {
            continue;
          }

          sightings.push({
            theme,
            profileName,
            profile: profileLabel,
            route: routePath,
            trail: current.trail,
            stateLabel: current.label,
            key: control.key,
            label: control.label,
            record,
          });
        }

        if (current.disclosure) {
          current.disclosure.status = 'captured';
        }
      } catch (error) {
        if (current.disclosure) {
          current.disclosure.status = 'failed';
        }

        issue('capture-failed', `${current.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return sightings;
  };

  const captureHovers = async (route: string, sightings: Sighting[]) => {
    routePath = route;

    const byState = new Map<string, Sighting[]>();

    for (const sighting of sightings) {
      const id = JSON.stringify(sighting.trail);
      const existing = byState.get(id);

      if (existing) existing.push(sighting);
      else byState.set(id, [sighting]);
    }

    for (const group of byState.values()) {
      const first = group[0];

      if (!first) continue;

      state = first.trail.length ? first.stateLabel : 'page';

      console.log(`[${side}] ${profileLabel} ${routePath} hovering ${group.length} in ${first.stateLabel}`);

      try {
        await context.clearCookies();
        await page.mouse.move(0, 0);
        await load();

        for (const key of first.trail) {
          await activate(key);
        }

        for (const sighting of group) {
          try {
            const target = (await getInventory(page)).find((item) => item.key === sighting.key);

            if (!target) throw new Error('Control disappeared before hover.');

            await page.locator(`[data-docs-compare-control="${target.index}"]`).hover();

            await page.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });

            await screenshot('hover', sighting.key, sighting.label, false);
            sighting.record.status = 'captured';
          } catch (error) {
            sighting.record.status = 'failed';
            issue('hover-failed', `${sighting.label}: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            await page.mouse.move(0, 0);
          }
        }
      } catch (error) {
        for (const sighting of group) {
          sighting.record.status = 'failed';
        }

        issue('capture-failed', `${first.stateLabel}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  return {
    key: profileLabel,
    capturePage,
    captureHovers,
    close: () => context.close(),
  };
};
