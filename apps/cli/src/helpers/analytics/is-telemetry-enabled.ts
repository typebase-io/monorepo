import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

export const isTelemetryEnabled = async () => {
  if (process.env.TYPEBASE_TELEMETRY_DISABLED || process.env.DO_NOT_TRACK) {
    return false;
  }

  const { telemetry } = await getTypebaseConfig();

  return telemetry.enabled;
};
