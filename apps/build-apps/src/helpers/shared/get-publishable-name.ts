export const getPublishableName = (appName: string) => {
  if (appName === '@typebase-io/cli') {
    return 'typebase-io-cli';
  }

  if (appName === '@typebase-io/core') {
    return 'typebase-io';
  }

  return appName;
};
