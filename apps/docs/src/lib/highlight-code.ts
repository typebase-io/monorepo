import { getHighlighter } from 'fumadocs-core/highlight';

export interface CodeToken {
  text: string;
  color?: string;
  italic?: boolean;
}

export type CodeLine = CodeToken[];

const theme = 'github-dark';

let highlighter: ReturnType<typeof getHighlighter> | null = null;

export async function highlightCode(code: string, lang: 'ts' | 'tsx' = 'ts'): Promise<CodeLine[]> {
  highlighter ??= getHighlighter('js', { langs: ['ts', 'tsx'], themes: [theme] });

  const { codeToTokens } = await highlighter;
  const { tokens } = codeToTokens(code, { lang, theme });

  return tokens.map((line) =>
    line.map((token) => ({
      text: token.content,
      color: token.color,
      ...(typeof token.fontStyle === 'number' && (token.fontStyle & 1) !== 0 ? { italic: true } : {}),
    }))
  );
}
