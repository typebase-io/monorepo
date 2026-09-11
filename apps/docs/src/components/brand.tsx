import Image from 'next/image';

import { display } from '#lib/fonts.ts';

export function Wordmark({ size = 'default' }: { size?: 'default' | 'small' }) {
  const small = size === 'small';

  return (
    <span className={`${display.className} inline-flex shrink-0 items-center ${small ? 'gap-2' : 'gap-2.5'}`}>
      <Image priority src="/logo.svg" alt="" width={26} height={35} className={small ? 'h-7 w-auto' : 'h-8 w-auto'} />
      <span className={`font-bold tracking-tight text-fd-foreground ${small ? 'text-[20px]' : 'text-[23px]'}`}>
        Typebase<span className="text-fd-primary">.</span>
      </span>
    </span>
  );
}
