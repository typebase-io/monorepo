export const MAX_BUCKET_NAME_LENGTH = 32;

const BUCKET_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const validateBucketName = (name: string) => {
  if (name.length > MAX_BUCKET_NAME_LENGTH || !BUCKET_NAME_PATTERN.test(name)) {
    throw new Error(
      `The storage bucket \`${name}\` has an invalid name. Bucket names use lowercase letters, digits, and hyphens, start and end with a letter or digit, and are at most ${MAX_BUCKET_NAME_LENGTH} characters long, so every storage provider accepts them.`
    );
  }
};
