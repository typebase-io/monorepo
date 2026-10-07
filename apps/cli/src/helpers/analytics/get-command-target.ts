import type { CommandUnknownOpts } from '@commander-js/extra-typings';

export const getCommandTarget = (command: CommandUnknownOpts): string | undefined => {
  const argumentIndex = command.registeredArguments.findIndex((argument) => argument.name() === 'target');

  if (argumentIndex !== -1) {
    return command.processedArgs[argumentIndex] as string | undefined;
  }

  for (let current: CommandUnknownOpts | null = command; current; current = current.parent) {
    if (current.name() === 'dev' || current.name() === 'prod') {
      return current.name();
    }
  }

  return undefined;
};
