import { type StandardRPCJsonSerializedMetaItem, StandardRPCJsonSerializer } from '@orpc/client/standard';

const serializer = new StandardRPCJsonSerializer();

export const deserializeEventValue = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || !('~typebase' in value)) {
    return value;
  }

  const { '~typebase': version, json, meta } = value as Record<string, unknown>;

  if (version !== 1) {
    throw new Error(
      `An event in the events table was written in format ${String(version)}, which this version of typebase-io cannot read. Upgrade typebase-io.`
    );
  }

  return serializer.deserialize(json, meta as StandardRPCJsonSerializedMetaItem[]);
};
