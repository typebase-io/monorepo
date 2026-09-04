export const cloudflareIndexFileTemplate = `import { typebaseHandler } from "./server.ts";

export default {
  fetch: typebaseHandler,
};
`;
