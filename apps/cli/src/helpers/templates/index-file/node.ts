export const nodeIndexFileTemplate = (port: number) => `import { createServer } from "node:http";
import { typebaseHandler } from "./server.ts";

const server = createServer(typebaseHandler);

server.listen(${port}, "127.0.0.1", () =>
  console.log("Listening on 127.0.0.1:${port}"),
);
`;
