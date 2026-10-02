export const indentLines = (code: string) =>
  code
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');
