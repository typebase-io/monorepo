import { R2_PUBLIC_URL_ENV_KEY_PREFIX } from '#helpers/constants.ts';

export const getR2PublicUrlEnvKey = (bucket: string): string => `${R2_PUBLIC_URL_ENV_KEY_PREFIX}${bucket.toUpperCase().replaceAll('-', '_')}`;
