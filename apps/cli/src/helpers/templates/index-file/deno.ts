export const denoIndexFileTemplate = (port: number) => `import { typebaseHandler } from "./server.ts";

Deno.serve({ port: ${port} }, typebaseHandler);
`;
