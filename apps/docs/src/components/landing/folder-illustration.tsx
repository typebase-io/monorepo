import { ArrowUpRight, CheckCheck, Code2, Database, FileCode2, FolderCode, LockKeyhole } from 'lucide-react';

import { ScrollTo } from '#components/landing/scroll-to.tsx';

const fileSheet =
  'absolute left-7 -top-9 block h-[225px] w-[286px] rounded-[5px] border border-[#4c7394] p-[17px] shadow-[0_-3px_8px_#00102024] motion-safe:transition-transform motion-safe:duration-450';

const fileSheetLabel = 'flex items-center gap-[9px] font-mono text-[11px] leading-normal text-[#284b69]';
const fileSheetLine = 'mt-5 block h-1 w-3/4 bg-[#89abc5] [&+i]:mt-[9px] [&+i]:w-[90%] last:w-[48%]';

export function FolderIllustration() {
  return (
    <ScrollTo
      targetId="folder-tree"
      label="Browse the files in a Typebase backend"
      className="group relative isolate mx-auto block h-95 w-full min-w-0 max-w-lg cursor-pointer self-center overflow-hidden rounded-lg border border-fd-primary/25 bg-fd-muted bg-[radial-gradient(#609dc44d_0.65px,transparent_0.65px)] bg-size-[12px_12px] sm:h-116.25"
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 size-64 -translate-1/2 rounded-full border border-fd-primary/25 after:absolute after:inset-8 after:rounded-full after:border after:border-fd-primary/15 min-[390px]:size-72 sm:size-86.25"
      />

      <span aria-hidden="true" className="absolute top-27 left-1/2 block h-63.75 w-85 -translate-x-1/2 sm:top-31">
        <span className="block size-full origin-top scale-70 min-[360px]:scale-80 sm:scale-100 lg:scale-90 xl:scale-100">
          <span className="relative block size-full -rotate-8 motion-safe:transition-transform motion-safe:duration-450 motion-safe:ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-4 motion-safe:group-focus-visible:-translate-y-1 motion-safe:group-focus-visible:-rotate-4">
            <span className="absolute inset-x-1.75 top-1.75 bottom-0 rounded-[12px_15px_10px_10px] border border-[#124b77] bg-[#175e91] shadow-[2px_26px_25px_-19px_#000a1677] before:absolute before:-top-5.5 before:-left-px before:h-8.25 before:w-32 before:rounded-[12px_20px_0_0] before:border before:border-b-0 before:border-[#124b77] before:bg-[#175e91]" />
            <span
              className={`${fileSheet} -translate-y-10 rotate-5 bg-[#83aac9] motion-safe:group-hover:-translate-y-13.25 motion-safe:group-hover:rotate-7 motion-safe:group-focus-visible:-translate-y-13.25 motion-safe:group-focus-visible:rotate-7`}
            >
              <span className={fileSheetLabel}>
                <LockKeyhole className="size-3.75" />
                auth.ts
              </span>
              <i className={fileSheetLine} />
              <i className={fileSheetLine} />
              <i className={fileSheetLine} />
            </span>
            <span
              className={`${fileSheet} -translate-y-3 -rotate-2 bg-[#a4c7e1] motion-safe:group-hover:-translate-y-5.25 motion-safe:group-hover:-rotate-4 motion-safe:group-focus-visible:-translate-y-5.25 motion-safe:group-focus-visible:-rotate-4`}
            >
              <span className={fileSheetLabel}>
                <Database className="size-3.75" />
                db/schema.ts
              </span>
              <i className={fileSheetLine} />
              <i className={fileSheetLine} />
              <i className={fileSheetLine} />
            </span>
            <span className={`${fileSheet} translate-y-4.75 rotate-2 bg-[#c2daec]`}>
              <span className={fileSheetLabel}>
                <FileCode2 className="size-3.75" />
                actions/todos.ts
              </span>
              <i className={fileSheetLine} />
              <i className={fileSheetLine} />
              <i className={fileSheetLine} />
            </span>
            <span className="absolute inset-x-0 top-17 bottom-0 block rounded-[6px_6px_12px_12px] border border-[#2375ac] bg-[linear-gradient(155deg,#64b8eb_2%,#3799d7_65%,#2586c9)] px-6.25 py-6 shadow-[inset_0_1px_0_#a3dcff,inset_0_-3px_0_#14568666,0_20px_30px_-23px_#020a15] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[repeating-linear-gradient(0deg,transparent_0_2px,#0f4367_3px,transparent_4px)] before:opacity-12">
              <span className="relative flex items-center gap-2.5 font-mono text-[25px] leading-normal tracking-tight text-[#07253c]">
                <FolderCode className="size-5.25" />
                typebase/
              </span>
              <span className="mt-4.5 block font-mono text-[8px] leading-relaxed tracking-widest text-[#0b2f48]">
                BIG BACKEND ENERGY.
                <br />
                ONE LITTLE FOLDER.
              </span>
              <span className="absolute right-5.75 bottom-7.5 flex -rotate-4 items-center gap-1.75 rounded-[3px] border border-[#143e5d88] p-1.75 text-[#0b2f48]">
                <Code2 className="size-6.25" />
                <span className="font-mono text-[7px] leading-normal">
                  100%
                  <br />
                  TYPESCRIPT
                </span>
              </span>
              <span className="absolute inset-x-4.25 bottom-2.5 h-0.75 border-y border-t-[#16568088] border-b-[#8ad5ff88]" />
            </span>
          </span>
        </span>
      </span>

      <span className="absolute top-19 right-3 flex rotate-8 items-center gap-1.75 rounded-sm border border-[#71a9d0] bg-fd-secondary-foreground px-3 py-2 font-mono text-[8px] leading-normal text-fd-primary-foreground shadow-[2px_3px_0_#00142655] sm:top-23.5 sm:right-2 sm:text-[10px]">
        <CheckCheck className="size-4" />
        types included.
      </span>
      <span className="absolute right-7 bottom-10 flex -rotate-5 items-center gap-3 font-serif text-xl italic text-fd-primary sm:bottom-12">
        Go on, open it.
        <ArrowUpRight className="size-4.5" />
      </span>
      <span className="absolute bottom-4 left-5 font-mono text-[7px] tracking-widest text-fd-muted-foreground sm:bottom-5 sm:left-6 sm:text-[8px]">
        TYPEBASE/ — OPEN FOR INSPECTION
      </span>
    </ScrollTo>
  );
}
