import type { CommandUnknownOpts } from '@commander-js/extra-typings';

export const getCommandTelemetryOptions = (command: CommandUnknownOpts): Record<string, unknown> => {
  const values = command.opts();
  const options: Record<string, unknown> = {};

  for (const option of command.options) {
    const key = option.attributeName();
    const value = values[key];

    if (value === undefined || command.getOptionValueSource(key) !== 'cli') {
      continue;
    }

    options[key] = typeof value === 'boolean' || option.argChoices ? value : true;
  }

  return options;
};
