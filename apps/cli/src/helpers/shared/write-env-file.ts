import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const writeEnvFile = async (name: string, value: string, envPath = path.resolve('.env')) => {
  const content = existsSync(envPath) ? await fs.readFile(envPath, 'utf8') : '';

  const line = `${name}=${value}`;
  const existingLine = new RegExp(`^(?:export[ \\t]+)?${name}[ \\t]*=.*$`, 'm');

  const next = existingLine.test(content)
    ? content.replace(existingLine, (match) => `${/^export[ \t]+/.exec(match)?.[0] ?? ''}${line}`)
    : `${content === '' || content.endsWith('\n') ? content : `${content}\n`}${line}\n`;

  await fs.writeFile(envPath, next, 'utf8');
};
