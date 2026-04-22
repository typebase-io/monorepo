import Link from 'next/link';
import { getServerSession } from 'typebase-io/client/auth/nextjs';
import SignOutButton from './sign-out-button';

export default async function Navbar() {
  const session = await getServerSession(process.env.TYPEBASE_APP_URL ?? '');

  if (!session) {
    return (
      <Link
        href="/auth"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{session.user.name || session.user.email}</span>
      <SignOutButton />
    </div>
  );
}
