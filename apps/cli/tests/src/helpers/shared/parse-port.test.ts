import { InvalidArgumentError } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { parsePort } from '#helpers/shared/parse-port.ts';

describe('parsePort', () => {
  it.each([
    { value: '8080', parsed: 8080 },
    { value: '1', parsed: 1 },
    { value: '65535', parsed: 65535 },
    { value: ' 3000 ', parsed: 3000 },
  ])('reads $value as a port', ({ value, parsed }) => {
    expect(parsePort(value)).toBe(parsed);
  });

  it.each([
    { name: 'zero', value: '0' },
    { name: 'a negative number', value: '-1' },
    { name: 'a fraction', value: '80.5' },
    { name: 'words', value: 'eighty' },
    { name: 'nothing', value: '' },
    { name: 'a number with a suffix', value: '8080abc' },
  ])('rejects $name', ({ value }) => {
    expect(() => parsePort(value)).toThrow(InvalidArgumentError);
    expect(() => parsePort(value)).toThrow('Port must be a positive integer.');
  });
});
