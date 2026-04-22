export const exampleAuthTemplate = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
  },
});`;
