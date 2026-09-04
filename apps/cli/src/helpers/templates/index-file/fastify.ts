export const fastifyIndexFileTemplate = (port: number, hasAuth: boolean, trustedOrigins: string[]) => {
  const corsImport = hasAuth ? `import cors from "@fastify/cors";\n` : '';

  const registerCors =
    hasAuth && trustedOrigins.length > 0
      ? `fastify.register(cors, {
  origin: [${trustedOrigins.map((origin) => JSON.stringify(origin)).join(', ')}],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});`
      : '';

  return `import Fastify from "fastify";
${corsImport}import { typebaseHandler } from "./server.ts";

const fastify = Fastify();

fastify.addContentTypeParser("*", (_request, _payload, done) => {
  done(null, undefined);
});

${registerCors ? `${registerCors}\n\n` : ''}fastify.register(typebaseHandler);

fastify
  .listen({ port: ${port} })
  .then(() => console.log("Listening on 127.0.0.1:${port}"));
`;
};
