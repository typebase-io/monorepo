export const readBodyUpTo = async (request: Request, limit: number | undefined): Promise<Uint8Array | undefined> => {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = (request.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.byteLength;

    if (limit !== undefined && size > limit) {
      await reader.cancel();

      return undefined;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
};
