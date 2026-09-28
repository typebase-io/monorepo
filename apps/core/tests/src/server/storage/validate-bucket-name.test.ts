import { describe, expect, it } from 'vitest';

import { MAX_BUCKET_NAME_LENGTH, validateBucketName } from '#server/storage/validate-bucket-name.ts';

describe('validateBucketName', () => {
  it.each(['avatars', 'a', 'user-files', 'v2', '9lives', 'a'.repeat(MAX_BUCKET_NAME_LENGTH)])('accepts %j', (name) => {
    expect(() => {
      validateBucketName(name);
    }).not.toThrow();
  });

  it.each(['', 'Avatars', 'my_files', 'my files', '-avatars', 'avatars-', 'a.b', 'a'.repeat(MAX_BUCKET_NAME_LENGTH + 1)])(
    'rejects %j, naming it and the rules',
    (name) => {
      expect(() => {
        validateBucketName(name);
      }).toThrow(
        `The storage bucket \`${name}\` has an invalid name. Bucket names use lowercase letters, digits, and hyphens, start and end with a letter or digit, and are at most 32 characters long, so every storage provider accepts them.`
      );
    }
  );
});
