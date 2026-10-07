import { createHash } from 'node:crypto';
import os from 'node:os';

import type { CommandUnknownOpts } from '@commander-js/extra-typings';

import { getCommandPath } from '#helpers/analytics/get-command-path.ts';
import { getCommandTarget } from '#helpers/analytics/get-command-target.ts';
import { getCommandTelemetryOptions } from '#helpers/analytics/get-command-telemetry-options.ts';
import { isTelemetryEnabled } from '#helpers/analytics/is-telemetry-enabled.ts';
import { postHogClient } from '#helpers/analytics/posthog-client.ts';
import { showTelemetryNotice } from '#helpers/analytics/show-telemetry-notice.ts';
import { getCliVersion } from '#helpers/shared/get-cli-version.ts';

export const trackCommand = async (command: CommandUnknownOpts) => {
  try {
    if (!(await isTelemetryEnabled())) {
      return;
    }

    await showTelemetryNotice();

    postHogClient.capture({
      distinctId: createHash('sha256').update(`typebase-telemetry:${os.hostname()}:${process.cwd()}`).digest('hex'),
      event: 'command_run',
      properties: {
        $process_person_profile: false,
        command: getCommandPath(command),
        target: getCommandTarget(command),
        options: getCommandTelemetryOptions(command),
        cli_version: getCliVersion(),
        node_version: process.version,
        os: process.platform,
        arch: process.arch,
        is_ci: Boolean(process.env.CI),
      },
    });

    postHogClient.flush().catch(() => undefined);
  } catch {
    // Telemetry must never stop the command the user asked for.
  }
};
