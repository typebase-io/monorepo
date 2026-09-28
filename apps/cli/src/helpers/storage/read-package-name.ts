import { getUserPackageInfo } from '#helpers/shared/get-user-package-info.ts';

export const readPackageName = async () => {
  try {
    return (await getUserPackageInfo()).packageJson.name;
  } catch {
    return undefined;
  }
};
