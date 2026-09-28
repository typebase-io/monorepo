import { describe, expect, it } from 'vitest';

import { toBucketNamePart } from '#helpers/storage/to-bucket-name-part.ts';

describe('toBucketNamePart', () => {
  it('keeps a name that is already a valid bucket name part', () => {
    expect(toBucketNamePart('my-app')).toBe('my-app');
  });

  it('lower-cases the name and turns every run of other characters into one dash', () => {
    expect(toBucketNamePart('@acme/My_App')).toBe('acme-my-app');
  });

  it('trims dashes from both ends', () => {
    expect(toBucketNamePart('--app--')).toBe('app');
  });

  it('cuts the name to 25 characters, without leaving a dash at the end', () => {
    expect(toBucketNamePart('a-very-long-project-name-that-goes-on')).toBe('a-very-long-project-name');
    expect(toBucketNamePart('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrstuvwxy');
  });

  it('is undefined when nothing usable is left', () => {
    expect(toBucketNamePart('@/_')).toBeUndefined();
    expect(toBucketNamePart('')).toBeUndefined();
  });
});
