import { getUserPackageInfo } from '#helpers/shared/get-user-package-info.ts';

export const getUserPackageJson = async (startDir = process.cwd()) => {
  return (await getUserPackageInfo(startDir)).packageJson;
};
