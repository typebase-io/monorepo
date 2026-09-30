import { StandardRPCJsonSerializer } from '@orpc/client/standard';

import { ServerError } from '#server/error/index.ts';

const serializer = new StandardRPCJsonSerializer();

export const serializeEventValue = (name: string, value: unknown) => {
  const [json, meta, , blobs] = serializer.serialize(value);

  if (blobs.length > 0) {
    throw new ServerError('INTERNAL_SERVER_ERROR', {
      message: `The payload published as \`${name}\` holds a Blob or File, which the events table cannot store. Upload it to storage and publish its key instead.`,
    });
  }

  return { '~typebase': 1, json, meta };
};
