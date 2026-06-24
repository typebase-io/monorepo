export const removeExtraSpaces = (source: string) => {
  const lines = source.split('\n');

  while (lines[0]?.trim() === '') {
    lines.shift();
  }

  while (lines.at(-1)?.trim() === '') {
    lines.pop();
  }

  const indentation = lines.reduce((min, line) => {
    if (line.trim() === '') {
      return min;
    }

    return Math.min(min, /^\s*/.exec(line)?.[0].length ?? 0);
  }, Number.POSITIVE_INFINITY);

  const spaces = indentation === Number.POSITIVE_INFINITY ? 0 : indentation;

  return `${lines.map((line) => line.slice(spaces)).join('\n')}\n`;
};
