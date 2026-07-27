interface Tail {
  url: string;
  deleteTail: () => Promise<void>;
}

export const createTail = async ({
  token,
  accountId,
  scriptName,
}: {
  token: string;
  accountId: string;
  scriptName: string;
}): Promise<Tail | undefined> => {
  const tailsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/tails`;

  const res = await fetch(tailsUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (res.status === 404) {
    return undefined;
  }

  if (!res.ok) {
    const body = await res.text();

    throw new Error(`Failed to start a Cloudflare tail session: ${body}`);
  }

  const data = (await res.json()) as { result: { id: string; url: string } };

  return {
    url: data.result.url,
    deleteTail: async () => {
      await fetch(`${tailsUrl}/${data.result.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  };
};
