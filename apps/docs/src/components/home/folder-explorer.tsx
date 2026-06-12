'use client';

import { FileCode, Folder } from 'lucide-react';
import { useState } from 'react';

import { C } from '#components/home/code-card/c.tsx';
import { F } from '#components/home/code-card/f.tsx';
import { CodeCard } from '#components/home/code-card/index.tsx';
import { K } from '#components/home/code-card/k.tsx';
import { Line } from '#components/home/code-card/line.tsx';
import { S } from '#components/home/code-card/s.tsx';
import { T } from '#components/home/code-card/t.tsx';
import { V } from '#components/home/code-card/v.tsx';

type FileId = 'mutations' | 'queries' | 'relations' | 'schema' | 'auth';

const rows: { id?: FileId; label: string; depth: number }[] = [
  { label: 'typebase/', depth: 0 },
  { label: 'actions/', depth: 1 },
  { label: 'mutations/', depth: 2 },
  { id: 'mutations', label: 'todos.ts', depth: 3 },
  { label: 'queries/', depth: 2 },
  { id: 'queries', label: 'todos.ts', depth: 3 },
  { label: 'db/', depth: 1 },
  { id: 'relations', label: 'relations.ts', depth: 2 },
  { id: 'schema', label: 'schema.ts', depth: 2 },
  { id: 'auth', label: 'auth.ts', depth: 1 },
];

const files: Record<FileId, { path: string; chip: string; content: React.ReactNode }> = {
  schema: {
    path: 'typebase/db/schema.ts',
    chip: 'you write this',
    content: (
      <>
        <Line>
          <C>{'// your tables. drizzle under the hood.'}</C>
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>p</V>
          {` } `}
          <K>from</K> <S>{"'typebase-io/db'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>export const</K> <F>todos</F> = <V>p</V>.<F>pgTable</F>(<S>{"'todos'"}</S>, {`{`}
        </Line>
        <Line indent={1}>
          <V>id</V>: <V>p</V>.<F>integer</F>().<F>primaryKey</F>().<F>generatedAlwaysAsIdentity</F>(),
        </Line>
        <Line indent={1}>
          <V>value</V>: <V>p</V>.<F>varchar</F>({`{ `}
          <V>length</V>: 255{` }`}).<F>notNull</F>(),
        </Line>
        <Line indent={1}>
          <V>completed</V>: <V>p</V>.<F>boolean</F>().<F>notNull</F>(),
        </Line>
        <Line indent={1}>
          <V>createdAt</V>: <V>p</V>.<F>timestamp</F>().<F>notNull</F>().<F>defaultNow</F>(),
        </Line>
        <Line>{`});`}</Line>
      </>
    ),
  },
  relations: {
    path: 'typebase/db/relations.ts',
    chip: 'you write this',
    content: (
      <>
        <Line>
          <C>{'// registers tables for db.query.todos.*'}</C>
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>q</V>
          {` } `}
          <K>from</K> <S>{"'typebase-io/db'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>import</K> * <K>as</K> <V>schema</V> <K>from</K> <S>{"'./schema.ts'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>export const</K> <F>relations</F> = <V>q</V>.<F>defineRelations</F>(<V>schema</V>, (<V>r</V>) {`=>`} ({`{`}
        </Line>
        <Line indent={1}>
          <V>todos</V>: {`{},`}
        </Line>
        <Line>{`}));`}</Line>
      </>
    ),
  },
  queries: {
    path: 'typebase/actions/queries/todos.ts',
    chip: 'you write this',
    content: (
      <>
        <Line>
          <C>{'// becomes client.queries.todos.getMany()'}</C>
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>z</V>
          {` } `}
          <K>from</K> <S>{"'zod'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>action</V>
          {` } `}
          <K>from</K> <S>{"'../../_generated/server.ts'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>export const</K> <F>getMany</F> = <V>action</V>
        </Line>
        <Line indent={1}>
          .<F>output</F>(<V>z</V>.<F>array</F>(<V>z</V>.<F>object</F>({`{`}
        </Line>
        <Line indent={2}>
          <V>id</V>: <V>z</V>.<F>number</F>(),
        </Line>
        <Line indent={2}>
          <V>value</V>: <V>z</V>.<F>string</F>(),
        </Line>
        <Line indent={2}>
          <V>completed</V>: <V>z</V>.<F>boolean</F>(),
        </Line>
        <Line indent={1}>{`})))`}</Line>
        <Line indent={1}>
          .<F>handler</F>(<K>async</K> ({`{ db }`}) {`=>`} {`{`}
        </Line>
        <Line indent={2}>
          <K>return</K> <V>db</V>.<V>query</V>.<V>todos</V>.<F>findMany</F>();
        </Line>
        <Line indent={1}>{`});`}</Line>
      </>
    ),
  },
  mutations: {
    path: 'typebase/actions/mutations/todos.ts',
    chip: 'you write this',
    content: (
      <>
        <Line>
          <C>{'// becomes client.mutations.todos.create()'}</C>
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>z</V>
          {` } `}
          <K>from</K> <S>{"'zod'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>action</V>
          {` } `}
          <K>from</K> <S>{"'../../_generated/server.ts'"}</S>;
        </Line>
        <Line>
          <K>import</K> {`{ `}
          <V>todos</V>
          {` } `}
          <K>from</K> <S>{"'../../db/schema.ts'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>export const</K> <F>create</F> = <V>action</V>
        </Line>
        <Line indent={1}>
          .<F>input</F>(<V>z</V>.<F>object</F>({`{ `}
          <V>value</V>: <V>z</V>.<F>string</F>().<F>min</F>(1){` }`}))
        </Line>
        <Line indent={1}>
          .<F>handler</F>(<K>async</K> ({`{ db, input }`}) {`=>`} {`{`}
        </Line>
        <Line indent={2}>
          <K>await</K> <V>db</V>.<F>insert</F>(<V>todos</V>).<F>values</F>({`{`}
        </Line>
        <Line indent={3}>
          <V>value</V>: <V>input</V>.<V>value</V>,
        </Line>
        <Line indent={3}>
          <V>completed</V>: <K>false</K>,
        </Line>
        <Line indent={2}>{`});`}</Line>
        <Line indent={1}>{`});`}</Line>
      </>
    ),
  },
  auth: {
    path: 'typebase/auth.ts',
    chip: 'you write this',
    content: (
      <>
        <Line>
          <C>{'// sessions, oauth, email/password. one file.'}</C>
        </Line>
        <Line />
        <Line>
          <K>import</K> {`{ `}
          <V>defineAuth</V>
          {` } `}
          <K>from</K> <S>{"'typebase-io/server'"}</S>;
        </Line>
        <Line />
        <Line>
          <K>export const</K> <F>auth</F> = <F>defineAuth</F>({`{`}
        </Line>
        <Line indent={1}>
          <V>trustedOrigins</V>: [<S>{"'http://localhost:3000'"}</S>],
        </Line>
        <Line indent={1}>
          <V>emailAndPassword</V>: {`{ `}
          <V>enabled</V>: <K>true</K>
          {` },`}
        </Line>
        <Line indent={1}>
          <V>socialProviders</V>: {`{`}
        </Line>
        <Line indent={2}>
          <V>github</V>: {`{`}
        </Line>
        <Line indent={3}>
          <V>clientId</V>: <V>process</V>.<V>env</V>.<T>GITHUB_CLIENT_ID</T>!,
        </Line>
        <Line indent={3}>
          <V>clientSecret</V>: <V>process</V>.<V>env</V>.<T>GITHUB_CLIENT_SECRET</T>!,
        </Line>
        <Line indent={2}>{`},`}</Line>
        <Line indent={1}>{`},`}</Line>
        <Line>{`});`}</Line>
      </>
    ),
  },
};

export function FolderExplorer() {
  const [selected, setSelected] = useState<FileId>('queries');

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start">
      <div className="rounded-xl border border-fd-border bg-fd-card p-3">
        <ul className="font-mono text-xs leading-relaxed">
          {rows.map((row) => {
            const padding = { paddingLeft: `${row.depth * 14 + 8}px` };
            const id = row.id;

            if (!id) {
              return (
                <li key={`${row.depth}-${row.label}`} style={padding} className="flex items-center gap-1.5 py-1.5 pr-2 text-fd-muted-foreground">
                  <Folder className="h-3.5 w-3.5 shrink-0 text-fd-muted-foreground/60" />
                  {row.label}
                </li>
              );
            }

            const isSelected = selected === id;

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(id);
                  }}
                  style={padding}
                  aria-pressed={isSelected}
                  className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors ${
                    isSelected ? 'bg-fd-primary/10 text-fd-primary' : 'text-fd-foreground/80 hover:bg-fd-muted/40 hover:text-fd-foreground'
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 shrink-0 text-fd-muted-foreground/60" />
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid min-w-0">
        {(Object.keys(files) as FileId[]).map((id) => {
          const file = files[id];
          const isSelected = selected === id;

          return (
            <div key={id} aria-hidden={!isSelected} className={`col-start-1 row-start-1 min-w-0 ${isSelected ? '' : 'invisible'}`}>
              <CodeCard title={file.path} label={file.chip}>
                {file.content}
              </CodeCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}
