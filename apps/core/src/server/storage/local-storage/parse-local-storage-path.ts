export type LocalStoragePath = { bucket: string; key: string } | 'not-found' | 'bad-key';

export const parseLocalStoragePath = (pathname: string, basePath: string): LocalStoragePath => {
  if (!pathname.startsWith(`${basePath}/`)) {
    return 'not-found';
  }

  const [bucket, ...keySegments] = pathname.slice(basePath.length + 1).split('/');

  if (!bucket || keySegments.length === 0 || keySegments.at(-1) === '') {
    return 'not-found';
  }

  try {
    const segments = keySegments.map(decodeURIComponent);
    const key = segments.join('/');

    if (key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
      return 'bad-key';
    }

    return { bucket: decodeURIComponent(bucket), key };
  } catch {
    return 'bad-key';
  }
};
