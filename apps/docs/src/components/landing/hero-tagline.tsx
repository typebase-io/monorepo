'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '#lib/cn.ts';

const defaultMessage = 'just use code. AI loves code.';

const secrets = [
  'hello, fellow human. or agent.',
  'this comment ships to production.',
  'no yaml was harmed making this page.',
  'rm -rf microservices/',
  'works on my machine. and yours.',
  'your agent already read this twice.',
  'someone approves this message.',
  '404: boilerplate not found.',
  'the testimonials are fake. this is real.',
  'still hovering? go ship something.',
  'ok, this is the last one. probably.',
];

const glyphs = '!<>-_\\/[]{}=+*^?#$%&';

const scrambleFrames = 22;
const scrambleFrameMs = 32;

export function HeroTagline({ align = 'center', className }: { align?: 'center' | 'left'; className?: string }) {
  const [text, setText] = useState(defaultMessage);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  function scrambleTo(target: string) {
    if (timerRef.current) clearInterval(timerRef.current);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(target);

      return;
    }

    let frame = 0;

    timerRef.current = setInterval(() => {
      frame += 1;

      if (frame >= scrambleFrames) {
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = null;
        setText(target);

        return;
      }

      const locked = Math.floor((frame / scrambleFrames) * target.length);
      let next = target.slice(0, locked);

      for (let i = locked; i < target.length; i++) {
        next += glyphs.charAt(Math.floor(Math.random() * glyphs.length));
      }

      setText(next);
    }, scrambleFrameMs);
  }

  function reveal() {
    const secret = secrets[indexRef.current % secrets.length] ?? defaultMessage;

    indexRef.current += 1;
    scrambleTo(secret);
  }

  function reset() {
    scrambleTo(defaultMessage);
  }

  return (
    <p className={cn('font-mono text-sm italic text-fd-muted-foreground', className)}>
      <button
        type="button"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') reveal();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') reset();
        }}
        onClick={reveal}
        className="relative inline-block touch-manipulation whitespace-nowrap focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fd-primary"
      >
        <span aria-hidden className="invisible">{`// ${defaultMessage}`}</span>
        <span className={cn('absolute top-0 w-max', align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2')}>
          <span className="select-none text-fd-muted-foreground/50">{'// '}</span>
          {text}
        </span>
      </button>
    </p>
  );
}
