'use client';

import { useEffect, useRef, useState } from 'react';

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

export function HeroTagline() {
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
    <p aria-label={`// ${defaultMessage}`} className="font-mono text-sm italic text-fd-muted-foreground">
      <span
        onMouseEnter={reveal}
        onMouseLeave={reset}
        onClick={reveal}
        aria-hidden
        className="relative inline-block cursor-default whitespace-nowrap"
      >
        <span className="invisible">{`// ${defaultMessage}`}</span>
        <span className="absolute left-1/2 top-0 w-max -translate-x-1/2">
          <span className="select-none text-fd-muted-foreground/50">{'// '}</span>
          {text}
        </span>
      </span>
    </p>
  );
}
