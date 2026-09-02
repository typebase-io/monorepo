import { InvalidArgumentError } from '@commander-js/extra-typings';

export const parsePort = (value: string): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Port must be a positive integer.');
  }

  return parsed;
};
