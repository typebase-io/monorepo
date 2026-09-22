'use client';

import { FileCode2, Folder } from 'lucide-react';
import { useId, useState } from 'react';

import { backendFiles, treeRows } from '#components/landing/backend-files.ts';
import { HighlightedCode } from '#components/landing/highlighted-code.tsx';
import type { CodeLine } from '#lib/highlight-code.ts';
import { trackLanding } from '#lib/track-landing.ts';

export function FolderTree({ highlighted }: { highlighted: Record<string, CodeLine[]> }) {
  const [selected, setSelected] = useState('queries');
  const panelId = useId();
  const file = backendFiles.find((item) => item.id === selected) ?? backendFiles[0];

  return (
    <div id="folder-tree" className="mt-10 grid scroll-mt-20 overflow-hidden rounded-lg border border-fd-primary/25 lg:grid-cols-[17rem_1fr]">
      <div className="border-b border-fd-border bg-fd-muted/20 p-3 lg:border-r lg:border-b-0">
        <ul className="font-mono text-xs">
          {treeRows.map((row) => {
            const indent = { paddingLeft: `${row.depth * 14 + 8}px` };

            if (!row.id) {
              return (
                <li key={`${row.depth}-${row.label}`} style={indent} className="flex items-center gap-2 py-2 pr-2 text-fd-muted-foreground">
                  <Folder aria-hidden className="size-3.5 shrink-0 text-fd-muted-foreground/60" />
                  {row.label}
                </li>
              );
            }

            const isSelected = selected === row.id;

            return (
              <li key={row.id}>
                <button
                  type="button"
                  style={indent}
                  aria-pressed={isSelected}
                  aria-controls={panelId}
                  onClick={() => {
                    setSelected(row.id ?? '');
                    trackLanding('landing_demo', { action: 'select_file', file: row.label });
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded py-2 pr-2 text-left transition-colors ${isSelected ? 'bg-fd-primary/15 text-fd-primary' : 'text-fd-foreground/80 hover:bg-fd-muted hover:text-fd-foreground'}`}
                >
                  <FileCode2 aria-hidden className="size-3.5 shrink-0 text-fd-muted-foreground/60" />
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div id={panelId} className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-fd-border px-4 py-3 font-mono text-xs sm:px-6">
          <span role="status" className="min-w-0 overflow-x-auto whitespace-nowrap text-fd-primary">
            {file?.path}
          </span>
          <span className="shrink-0 rounded bg-fd-primary/15 px-2 py-0.5 text-[10px] tracking-wider text-fd-primary uppercase">{file?.chip}</span>
        </div>
        <div className="grid min-w-0">
          {backendFiles.map((item) => (
            <div
              key={item.id}
              inert={selected !== item.id}
              className={`col-start-1 row-start-1 flex min-w-0 flex-col ${selected === item.id ? '' : 'invisible max-md:hidden'}`}
            >
              <div className="flex-1">
                <HighlightedCode lines={highlighted[item.id] ?? []} />
              </div>
              <p className="border-t border-fd-border px-4 py-4 text-xs leading-5 text-fd-muted-foreground sm:px-6">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
