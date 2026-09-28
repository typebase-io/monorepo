export const mediaType = (contentType: string | null) => {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
};
