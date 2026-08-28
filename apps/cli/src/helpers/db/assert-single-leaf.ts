import { type Migration } from '#helpers/db/read-migrations.ts';

export const assertSingleLeaf = (migrations: Migration[]) => {
  const claimedParents = new Set(migrations.flatMap(({ snapshot }) => snapshot.prevIds));
  const leavesMap = new Map<string, Migration>();

  for (const migration of migrations) {
    if (!claimedParents.has(migration.snapshot.id)) {
      leavesMap.set(migration.snapshot.id, migration);
    }
  }

  const leaves = [...leavesMap.values()];

  if (leaves.length < 2) {
    return;
  }

  const names = leaves.map(({ name }) => `  ${name}`).join('\n');

  throw new Error(
    `Your migration history has forked. These ${leaves.length} migrations each continue from the same point, so there is no single snapshot to generate from:\n\n${names}\n\n` +
      'This usually happens when two branches each recorded a migration and were then merged. Delete all but one of them, re-run generate, and commit the migration that replaces them.\n\n' +
      'Pass --ignore-conflicts to generate anyway.'
  );
};
