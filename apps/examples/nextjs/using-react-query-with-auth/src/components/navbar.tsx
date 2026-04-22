'use client';

import Link from 'next/link';
import { authClient } from '../lib/typebase/client/auth-client';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();
  const session = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/auth');
    router.refresh();
  };

  if (session.isPending || session.error) {
    return <div className="h-7.5 w-full" />;
  }

  if (!session.data) {
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
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{session.data.user.name || session.data.user.email}</span>

      <button
        type="button"
        className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  );
}
