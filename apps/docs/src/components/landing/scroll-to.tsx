'use client';

import type { ReactNode } from 'react';

export function ScrollTo({ targetId, label, className, children }: { targetId: string; label?: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={() => {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }}
    >
      {children}
    </button>
  );
}
