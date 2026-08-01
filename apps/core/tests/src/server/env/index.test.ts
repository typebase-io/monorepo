import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineEnv } from '#server/env/index.ts';

const INVALID_ENV_LABEL = '❌ Invalid environment variables:';

describe('defineEnv', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the parsed variables from process.env', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db');
    vi.stubEnv('PORT', '3000');

    const env = defineEnv({
      DATABASE_URL: z.string(),
      PORT: z.coerce.number(),
    });

    expect(env.DATABASE_URL).toBe('postgres://localhost/db');
    expect(env.PORT).toBe(3000);
  });

  it('logs nothing when every variable is valid', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db');

    defineEnv({ DATABASE_URL: z.string() });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('throws when a required variable is missing', () => {
    vi.stubEnv('MISSING_VAR', undefined);

    expect(() => defineEnv({ MISSING_VAR: z.string() })).toThrow('Invalid environment variables');
  });

  it('names the missing variable on the console before throwing', () => {
    vi.stubEnv('MISSING_VAR', undefined);

    expect(() => defineEnv({ MISSING_VAR: z.string() })).toThrow();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      INVALID_ENV_LABEL,
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_type', expected: 'string', path: ['MISSING_VAR'] })])
    );
  });

  it('throws when a variable does not match its schema', () => {
    vi.stubEnv('NUMERIC_VAR', 'not-a-number');

    expect(() => defineEnv({ NUMERIC_VAR: z.coerce.number() })).toThrow('Invalid environment variables');
  });

  it('names the invalid variable on the console before throwing', () => {
    vi.stubEnv('NUMERIC_VAR', 'not-a-number');

    expect(() => defineEnv({ NUMERIC_VAR: z.coerce.number() })).toThrow();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      INVALID_ENV_LABEL,
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_type', expected: 'number', path: ['NUMERIC_VAR'] })])
    );
  });

  it('reports every invalid variable in one message', () => {
    vi.stubEnv('FIRST_VAR', undefined);
    vi.stubEnv('SECOND_VAR', undefined);

    expect(() => defineEnv({ FIRST_VAR: z.string(), SECOND_VAR: z.string() })).toThrow();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      INVALID_ENV_LABEL,
      expect.arrayContaining([expect.objectContaining({ path: ['FIRST_VAR'] }), expect.objectContaining({ path: ['SECOND_VAR'] })])
    );
  });

  it('ignores variables that are not part of the schema', () => {
    vi.stubEnv('IN_SCHEMA', 'yes');
    vi.stubEnv('NOT_IN_SCHEMA', 'also set');

    const env = defineEnv({ IN_SCHEMA: z.string() });

    expect(env).not.toHaveProperty('NOT_IN_SCHEMA');
  });

  it('applies schema defaults', () => {
    vi.stubEnv('WITH_DEFAULT', undefined);

    const env = defineEnv({ WITH_DEFAULT: z.string().default('fallback') });

    expect(env.WITH_DEFAULT).toBe('fallback');
  });

  it('treats an empty string as undefined by default', () => {
    vi.stubEnv('EMPTY_VAR', '');

    expect(() => defineEnv({ EMPTY_VAR: z.string() })).toThrow('Invalid environment variables');
    expect(defineEnv({ EMPTY_VAR: z.string().default('fallback') }).EMPTY_VAR).toBe('fallback');
  });

  it('reports an empty string as a missing variable, not as an empty one', () => {
    vi.stubEnv('EMPTY_VAR', '');

    expect(() => defineEnv({ EMPTY_VAR: z.string() })).toThrow();

    expect(consoleError).toHaveBeenCalledWith(
      INVALID_ENV_LABEL,
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_type', expected: 'string', path: ['EMPTY_VAR'] })])
    );
  });

  it('keeps empty strings when emptyStringAsUndefined is false', () => {
    vi.stubEnv('EMPTY_VAR', '');

    const env = defineEnv({ EMPTY_VAR: z.string() }, { emptyStringAsUndefined: false });

    expect(env.EMPTY_VAR).toBe('');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('skips validation when skipValidation is true', () => {
    vi.stubEnv('MISSING_VAR', undefined);

    expect(() => defineEnv({ MISSING_VAR: z.string() }, { skipValidation: true })).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('accepts an empty schema', () => {
    expect(() => defineEnv({})).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
