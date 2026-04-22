import { z } from 'zod';

import { action } from '../../_generated/server.ts';

export const getMany = action
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
  .handler(async ({ db }) => {
    const todos = await db.query.todos.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return todos.map((todo) => ({
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
      createdAt: todo.createdAt,
    }));
  });
