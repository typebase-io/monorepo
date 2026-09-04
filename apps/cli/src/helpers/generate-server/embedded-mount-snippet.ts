import { type ServerAdapter, type ServerOutput } from '#helpers/constants.ts';

export const embeddedMountSnippet = ({ adapter, output, importPath }: { adapter: ServerAdapter; output: ServerOutput; importPath: string }) => {
  const importStatement =
    output === 'cjs'
      ? `const { typebaseHandler } = require(${JSON.stringify(importPath)});`
      : `import { typebaseHandler } from ${JSON.stringify(importPath)};`;

  const mount = {
    node: '// In your existing Express application:\napp.use(typebaseHandler);',
    fastify: '// In your existing Fastify application:\nawait app.register(typebaseHandler);',
    hono: '// In your existing Hono application:\napp.route("/", typebaseHandler);',
    bun: "// Use this fetch handler in your host's Bun.serve configuration:\nBun.serve({ fetch: typebaseHandler });",
    deno: "// Use this handler in your host's Deno.serve call:\nDeno.serve(typebaseHandler);",
    cloudflare: `// In your Worker entry point:\n${output === 'cjs' ? 'module.exports =' : 'export default'} { fetch: typebaseHandler };`,
  }[adapter];

  return `${importStatement}\n\n${mount}`;
};
