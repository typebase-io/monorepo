export const parseBucketMap = (value: string): Record<string, string> | undefined => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || Object.values(parsed).some((entry) => typeof entry !== 'string')) {
    return undefined;
  }

  return parsed as Record<string, string>;
};
