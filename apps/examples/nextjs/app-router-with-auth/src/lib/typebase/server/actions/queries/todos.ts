import { z } from 'zod';

import { authedAction } from '../custom-actions.ts';

export const getMany = authedAction
  .output(
    z
      .object({
        id: z.number(),
        value: z.string(),
        completed: z.boolean(),
        createdAt: z.date(),
      })
      .array()
  )
  .handler(async ({ db, user }) => {
    const todos = await db.query.todos.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return todos.map((todo) => ({
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
      createdAt: todo.createdAt,
    }));
  });
