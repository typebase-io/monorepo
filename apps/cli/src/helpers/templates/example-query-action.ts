export const exampleQueryActionTemplate = (withAuth: boolean, withPublisher: boolean) => {
  const action = withAuth ? 'authedAction' : 'action';
  const where = withAuth ? 'where: { userId: user.id },\n\t\t\torderBy: { createdAt: "desc" },' : 'orderBy: { createdAt: "desc" },';

  const streamWhere = withAuth ? 'where: { userId: user.id },\n        orderBy: { createdAt: "desc" },' : 'orderBy: { createdAt: "desc" },';

  const listShape = `z
      .object({
        id: z.number(),
        value: z.string(),
        completed: z.boolean(),
      })
      .array()`;

  const getMany = withPublisher
    ? `export const getMany = ${action}
  .output(
    ${listShape},
  )
  .stream(async function* ({ db, publisher, signal, lastEventId${withAuth ? ', user' : ''} }) {
    const read = async () => {
      const todos = await db.query.todos.findMany({
        ${streamWhere}
      });

      return todos.map((todo) => ({
        id: todo.id,
        value: todo.value,
        completed: todo.completed,
      }));
    };

    yield await read();

    const created = await publisher.subscribe("todo.created", { signal, lastEventId });

    for await (const _todo of created) {
      yield await read();
    }
  });`
    : `export const getMany = ${action}
  .output(
    ${listShape},
  )
  .handler(async ({ db${withAuth ? ', user' : ''} }) => {
    const todos = await db.query.todos.findMany({
      ${where}
    });

    return todos.map((todo) => ({
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
    }));
  });`;

  return `import { ServerError } from "typebase-io/server";
import { z } from "zod";

${withAuth ? 'import { authedAction } from "../custom-actions.ts";' : 'import { action } from "../../_generated/server.ts";'}

export const getOne = ${action}
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

${getMany}`;
};
