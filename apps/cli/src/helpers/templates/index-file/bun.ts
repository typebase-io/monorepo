export const bunIndexFileTemplate = (port: number) => `import { typebaseHandler } from "./server.ts";

Bun.serve({
  port: ${port},
  fetch: typebaseHandler,
});
`;
