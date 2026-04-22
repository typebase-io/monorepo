export const exampleQueryActionTemplate = (withAuth: boolean) => {
  return `import { ServerError } from "typebase-io/server";
import { z } from "zod";

${withAuth ? 'import { authedAction } from "../custom-actions.ts";' : 'import { action } from "../../_generated/server.ts";'}

export const getOne = ${withAuth ? 'authedAction' : 'action'}
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      value: z.string(),
      completed: z.boolean(),
    }),
  )
  .handler(async ({ db, input${withAuth ? ', user' : ''} }) => {
    const todo = await db.query.todos.findFirst({
      where: { id: input.id${withAuth ? ', userId: user.id' : ''} },
    });

    if (!todo) {
      throw new ServerError("NOT_FOUND");
    }

    return {
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
    };
  });

export const getMany = ${withAuth ? 'authedAction' : 'action'}
  .output(
    z
      .object({
        id: z.number(),
        value: z.string(),
        completed: z.boolean(),
      })
      .array(),
  )
  .handler(async ({ db${withAuth ? ', user' : ''} }) => {
    const todos = await db.query.todos.findMany({
      ${withAuth ? 'where: { userId: user.id },\n\t\t\torderBy: { createdAt: "desc" },' : 'orderBy: { createdAt: "desc" },'}
    });

    return todos.map((todo) => ({
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
    }));
  });`;
};
