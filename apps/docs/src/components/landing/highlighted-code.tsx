type TokenKind = 'comment' | 'constant' | 'fn' | 'keyword' | 'plain' | 'string' | 'tag';

interface Token {
  kind: TokenKind;
  text: string;
}

const keywords = new Set([
  'as',
  'async',
  'await',
  'class',
  'const',
  'default',
  'export',
  'extends',
  'from',
  'function',
  'if',
  'import',
  'interface',
  'let',
  'new',
  'return',
  'throw',
  'type',
  'var',
]);

const constants = new Set(['false', 'null', 'true', 'undefined']);

const declarators = /\b(?:class|const|function|let|var)$/;
const quoted = /^(['"`])(?:\\.|(?!\1)[^\\])*\1?/;
const openingTag = /^(<\/?)([A-Za-z][\w.-]*)/;
const word = /^[A-Za-z_$][\w$]*/;

const tokenClass: Record<TokenKind, string> = {
  comment: 'text-fd-muted-foreground italic',
  constant: 'text-[#7aa2e8]',
  fn: 'text-[#e0b35a]',
  keyword: 'text-[#7aa2e8]',
  plain: 'text-[#cfd6e6]',
  string: 'text-[#7fbf7b]',
  tag: 'text-[#c78bd9]',
};

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  function push(kind: TokenKind, text: string) {
    const previous = tokens.at(-1);

    if (previous?.kind === kind) previous.text += text;
    else tokens.push({ kind, text });
  }

  while (index < line.length) {
    const rest = line.slice(index);

    if (rest.startsWith('//')) {
      push('comment', rest);

      break;
    }

    const string = quoted.exec(rest)?.[0];

    if (string) {
      push('string', string);
      index += string.length;

      continue;
    }

    const tag = openingTag.exec(rest);

    if (tag) {
      const [match = '', bracket = '', name = ''] = tag;

      push('plain', bracket);
      push('tag', name);
      index += match.length;

      continue;
    }

    const name = word.exec(rest)?.[0];

    if (name) {
      const before = line.slice(0, index).trimEnd();
      const isCall = rest.slice(name.length).trimStart().startsWith('(');
      let kind: TokenKind = 'plain';

      if (before.endsWith('.')) kind = isCall ? 'fn' : 'plain';
      else if (keywords.has(name)) kind = 'keyword';
      else if (constants.has(name)) kind = 'constant';
      else if (isCall || declarators.test(before)) kind = 'fn';

      push(kind, name);
      index += name.length;

      continue;
    }

    push('plain', rest.slice(0, 1));
    index += 1;
  }

  return tokens;
}

const highlighted = 'border-l-2 border-fd-primary bg-fd-primary/10 -mx-4 pr-4 pl-[calc(1rem-2px)] sm:-mx-6 sm:pr-6 sm:pl-[calc(1.5rem-2px)]';

export function HighlightedCode({ code, highlight }: { code: string; highlight?: number }) {
  return (
    <pre
      className="overflow-x-auto px-4 py-6 font-mono text-[11px] leading-7 sm:px-6 sm:text-xs lg:text-[13px]"
      tabIndex={0}
      aria-label="TypeScript example"
    >
      <code>
        {code.split('\n').map((line, index) => (
          <span key={index} className={`block min-h-7 ${highlight === index + 1 ? highlighted : ''}`}>
            <span aria-hidden="true" className="mr-5 inline-block w-4 select-none text-right text-fd-muted-foreground/70">
              {index + 1}
            </span>
            {tokenize(line).map((token, tokenIndex) => (
              <span key={tokenIndex} className={tokenClass[token.kind]}>
                {token.text}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );
}
