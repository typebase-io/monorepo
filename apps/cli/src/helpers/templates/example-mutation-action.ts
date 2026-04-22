export const exampleMutationActionTemplate = (withAuth: boolean) => {
  return `import { q } from "typebase-io/db";
import { ServerError } from "typebase-io/server";
import { z } from "zod";

import { todos } from "../../db/schema.ts";
${withAuth ? 'import { authedAction } from "../custom-actions.ts";' : 'import { action } from "../../_generated/server.ts";'}

export const create = ${withAuth ? 'authedAction' : 'action'}
  .input(
    z.object({
      value: z.string(),
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
    const result = await db
      .insert(todos)
      .values({
        ${withAuth ? 'userId: user.id,\n\t\t\t\tvalue: input.value,' : 'value: input.value,'}
        completed: false,
      })
      .returning();

    const todo = result.at(0);

    if (!todo) {
      throw new ServerError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
    };
  });

export const toggle = ${withAuth ? 'authedAction' : 'action'}
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

    await db
      .update(todos)
      .set({ completed: !todo.completed })
      .where(q.eq(todos.id, todo.id));

    return {
      id: todo.id,
      value: todo.value,
      completed: !todo.completed,
    };
  });

export const deleteTodo = ${withAuth ? 'authedAction' : 'action'}
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(z.void())
  .handler(async ({ db, input${withAuth ? ', user' : ''} }) => {
    const todo = await db.query.todos.findFirst({
      where: { id: input.id${withAuth ? ', userId: user.id' : ''} },
    });

    if (!todo) {
      throw new ServerError("NOT_FOUND");
    }

    await db.delete(todos).where(q.eq(todos.id, todo.id));

    return;
  });`;
};
