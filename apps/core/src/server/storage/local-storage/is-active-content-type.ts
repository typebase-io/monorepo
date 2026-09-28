import { mediaType } from '#server/storage/local-storage/media-type.ts';

const ACTIVE_MEDIA_TYPES = new Set(['text/html', 'text/xml', 'application/xml']);

export const isActiveContentType = (contentType: string) => {
  const type = mediaType(contentType);

  return ACTIVE_MEDIA_TYPES.has(type) || type.endsWith('+xml');
};
