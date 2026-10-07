import { chalkStderr } from 'chalk';

import { TYPEBASE_CONFIG_FILE_NAME } from '#helpers/constants.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

export const showTelemetryNotice = async () => {
  const { telemetry } = await getTypebaseConfig();

  if (telemetry.noticeShown) {
    return;
  }

  console.error(
    chalkStderr.yellow(
      [
        'Typebase now collects anonymous usage data to learn which commands and options are used.',
        'It never records paths, URLs, secrets or your code.',
        `To opt out, set \`"telemetry": { "enabled": false }\` in \`${TYPEBASE_CONFIG_FILE_NAME}\`.`,
        '',
      ].join('\n')
    )
  );

  await writeTypebaseConfig({ telemetry: { enabled: telemetry.enabled, noticeShown: true } });
};
