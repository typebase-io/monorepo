import type { CommandUnknownOpts } from '@commander-js/extra-typings';

export const getCommandPath = (command: CommandUnknownOpts): string => {
  const names: string[] = [];
  let current = command;

  while (current.parent) {
    names.unshift(current.name());
    current = current.parent;
  }

  return names.join(' ');
};
