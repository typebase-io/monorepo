'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { type KeyboardEvent, useRef, useState } from 'react';

import { HighlightedCode } from '#components/landing/highlighted-code.tsx';
import { steps } from '#components/landing/walkthrough-steps.ts';
import { trackLanding } from '#lib/track-landing.ts';

export function CodeWalkthrough() {
  const [activeStep, setActiveStep] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function selectStep(index: number) {
    setActiveStep(index);
    trackLanding('landing_demo', { action: 'select_step', step: steps[index]?.name ?? '' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % steps.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + steps.length - 1) % steps.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = steps.length - 1;
    else return;

    event.preventDefault();
    selectStep(nextIndex);
    tabs.current[nextIndex]?.focus();
  }

  return (
    <div className="mt-10 grid overflow-hidden rounded-lg border border-fd-primary/25 lg:grid-cols-[1.6fr_1fr]">
      <div className="min-w-0 bg-fd-muted/35">
        <div role="tablist" aria-label="How Typebase connects your app" className="grid grid-cols-3 border-b border-fd-border">
          {steps.map((item, index) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              ref={(element) => {
                tabs.current[index] = element;
              }}
              id={`example-tab-${index}`}
              aria-controls={`example-panel-${index}`}
              aria-selected={activeStep === index}
              tabIndex={activeStep === index ? 0 : -1}
              onClick={() => {
                selectStep(index);
              }}
              onKeyDown={(event) => {
                handleKeyDown(event, index);
              }}
              className={`relative flex cursor-pointer flex-col items-start gap-1 px-3 py-4 text-left text-xs transition-colors sm:flex-row sm:items-center sm:gap-2 sm:px-5 sm:text-sm ${activeStep === index ? 'bg-fd-primary/10 text-fd-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-fd-primary' : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'}`}
            >
              <span className="font-mono text-[10px]">0{index + 1}</span>
              {item.name}
            </button>
          ))}
        </div>
        <div className="grid min-w-0">
          {steps.map((item, index) => (
            <div
              key={item.name}
              role="tabpanel"
              id={`example-panel-${index}`}
              aria-labelledby={`example-tab-${index}`}
              inert={activeStep !== index}
              className={`col-start-1 row-start-1 flex min-w-0 flex-col ${activeStep === index ? '' : 'invisible max-md:hidden'}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-fd-border px-4 py-3 font-mono text-[10px] text-fd-muted-foreground sm:px-6 sm:text-xs">
                <span className="min-w-0 break-all">{item.file}</span>
                <span className="text-fd-primary" aria-label="TypeScript">
                  TS
                </span>
              </div>
              <div className="flex-1 md:min-h-77">
                <HighlightedCode code={item.code} />
              </div>
              <p className="border-t border-fd-border px-4 py-4 text-xs leading-5 text-fd-muted-foreground sm:px-6">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col border-t border-fd-primary/25 bg-fd-muted/60 p-6 sm:p-8 lg:border-t-0 lg:border-l">
        <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fd-primary">
          <span className="size-1.5 rounded-full bg-fd-primary" /> Follow the types
        </div>
        <div className="grid min-w-0">
          {steps.map((item, index) => (
            <div
              key={item.name}
              inert={activeStep !== index}
              className={`col-start-1 row-start-1 min-w-0 ${activeStep === index ? '' : 'invisible max-md:hidden'}`}
            >
              <h3 className="max-w-xs text-3xl font-semibold leading-tight tracking-tight">{item.heading}</h3>
              <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">{item.description}</p>
              <Link
                href={item.guide}
                className="mt-5 inline-flex w-fit items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline"
              >
                {item.guideLabel}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
