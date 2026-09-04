import { type ServerMode } from '#helpers/constants.ts';

export interface ServerFileOptions {
  routerCode: string;
  hasAuth: boolean;
  trustedOrigins: string[];
  mode: ServerMode;
  actionsPath: string;
  authPath: string | { fromAuth: true };
}
