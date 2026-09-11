import Image from 'next/image';
import type { ReactNode } from 'react';

export function BrandTitle({ children, logo }: { children: ReactNode; logo?: string }) {
  return (
    <h3 className="flex min-h-9 items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
      {logo ? <Image src={logo} alt="" width={26} height={35} className="h-7 w-auto sm:h-8" /> : null}
      {children}
    </h3>
  );
}
