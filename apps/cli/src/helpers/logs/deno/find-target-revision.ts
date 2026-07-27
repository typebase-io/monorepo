export const findTargetRevision = async ({
  token,
  projectId,
  target,
}: {
  token: string;
  projectId: string;
  target: 'dev' | 'prod';
}): Promise<string | undefined> => {
  const revisionsRes = await fetch(`https://api.deno.com/v2/apps/${projectId}/revisions?status=succeeded&limit=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!revisionsRes.ok) {
    throw new Error(await revisionsRes.text());
  }

  const revisions = (await revisionsRes.json()) as { id: string }[];

  for (const revision of revisions) {
    const timelinesRes = await fetch(`https://api.deno.com/v2/revisions/${revision.id}/timelines`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!timelinesRes.ok) {
      throw new Error(await timelinesRes.text());
    }

    const timelines = (await timelinesRes.json()) as { slug: string }[];
    const isProduction = timelines.some(({ slug }) => slug === 'production');

    if (target === 'prod' ? isProduction : !isProduction) {
      return revision.id;
    }
  }

  return undefined;
};
