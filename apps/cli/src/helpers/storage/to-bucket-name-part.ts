const MAX_PROJECT_NAME_LENGTH = 25;

export const toBucketNamePart = (name: string): string | undefined => {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_PROJECT_NAME_LENGTH)
    .replace(/-+$/, '');

  return cleaned === '' ? undefined : cleaned;
};
