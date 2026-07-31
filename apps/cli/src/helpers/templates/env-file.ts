import { type EnvTarget, type ServerAdapter } from '#helpers/constants.ts';

export const envFileTemplate = ({
  adapter,
  target,
  schema,
  options,
  imports,
}: {
  adapter: ServerAdapter;
  target: EnvTarget | undefined;
  schema: string;
  options: Record<string, string>;
  imports: string[];
}) => {
  const allImports = [
    'import { createEnv } from "@t3-oss/env-core";',
    adapter === 'cloudflare' ? 'import { env as runtimeEnv } from "cloudflare:workers";' : '',
    ...imports,
  ].filter(Boolean);

  const allOptions = [
    ...Object.entries({
      runtimeEnv: adapter === 'cloudflare' ? 'runtimeEnv' : 'process.env',
      emptyStringAsUndefined: 'true',
      skipValidation: 'false',
      ...options,
    }).map(([key, value]) => (key === value ? `  ${key},` : `  ${key}: ${value},`)),
    `  onValidationError: (issues) => {
    const entries = issues.map((issue) => ({ name: String(issue.path?.[0] ?? "?"), message: issue.message }));
    const width = Math.max(0, ...entries.map((entry) => entry.name.length));

    console.error(
      [
        "",
        "✗ Typebase server failed to start.",
        "",
        "  Invalid environment variables:",
        ...entries.map((entry) => \`    \${entry.name.padEnd(width)}  \${entry.message}\`),
        "",
        "  Set them with:",
        "    npx typebase-io-cli env ${target ?? '<target>'} add <KEY> <value>",
        "",
      ].join("\\n"),
    );

    throw new Error("Typebase server failed to start: invalid environment variables.");
  },`,
  ];

  const blocks = [
    allImports.join('\n'),
    `export const env = createEnv({
  server: ${schema},
${allOptions.join('\n')}
});`,
  ].filter(Boolean);

  return `${blocks.join('\n\n')}\n`;
};
