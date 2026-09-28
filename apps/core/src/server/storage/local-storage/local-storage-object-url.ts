export const localStorageObjectUrl = (baseUrl: string, bucket: string, key: string) => {
  return `${baseUrl}/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
};
