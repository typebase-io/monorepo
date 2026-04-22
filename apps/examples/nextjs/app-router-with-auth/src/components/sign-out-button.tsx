'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '../lib/typebase/client/auth-client';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/auth');
    router.refresh();
  };

  return (
    <button
      type="button"
      className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
}
