import { hasMigrations } from '#helpers/shared/has-migrations.ts';

export const assertNotMigrationsMode = ({ migrationsDirPath, target }: { migrationsDirPath: string; target: 'dev' | 'prod' | 'local' }) => {
  if (hasMigrations(migrationsDirPath)) {
    throw new Error(
      `This project uses migrations, so pushing would change the schema without recording it. Run \`db ${target} migrate\` to apply your migrations instead.`
    );
  }
};
