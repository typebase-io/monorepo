'use client';

import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { Search } from 'lucide-react';

export function SearchTrigger({ className }: { className?: string }) {
  const { enabled, setOpenSearch } = useSearchContext();

  if (!enabled) return null;

  return (
    <button
      type="button"
      aria-label="Search the docs"
      onClick={() => {
        setOpenSearch(true);
      }}
      className={className}
    >
      <Search aria-hidden className="size-4" />
    </button>
  );
}
