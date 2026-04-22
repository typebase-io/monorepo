import { q } from 'typebase-io/db';
import { ServerError } from 'typebase-io/server';
import { z } from 'zod';

import { todos } from '../../db/schema.ts';
import { authedAction } from '../custom-actions.ts';

export const create = authedAction
  .input(
    z.object({
      value: z.string(),
    })
  )
  .output(
    z.object({
      id: z.number(),
      value: z.string(),
      completed: z.boolean(),
      createdAt: z.date(),
    })
  )
  .handler(async ({ db, user, input }) => {
    const result = await db
      .insert(todos)
      .values({
        value: input.value,
        completed: false,
        userId: user.id,
      })
      .returning();

    const todo = result.at(0);

    if (!todo) {
      throw new ServerError('INTERNAL_SERVER_ERROR');
    }

    return {
      id: todo.id,
      value: todo.value,
      completed: todo.completed,
      createdAt: todo.createdAt,
    };
  });

export const toggle = authedAction
  .input(
    z.object({
      id: z.number(),
    })
  )
  .output(
    z.object({
      id: z.number(),
      value: z.string(),
      completed: z.boolean(),
      createdAt: z.date(),
    })
  )
  .handler(async ({ db, user, input }) => {
    const todo = await db.query.todos.findFirst({
      where: { id: input.id, userId: user.id },
    });

    if (!todo) {
      throw new ServerError('NOT_FOUND');
    }

    await db.update(todos).set({ completed: !todo.completed }).where(q.eq(todos.id, todo.id));

    return {
      id: todo.id,
      value: todo.value,
      completed: !todo.completed,
      createdAt: todo.createdAt,
    };
  });

export const deleteTodo = authedAction
  .input(
    z.object({
      id: z.number(),
    })
  )
  .output(z.void())
  .handler(async ({ db, user, input }) => {
    const todo = await db.query.todos.findFirst({
      where: { id: input.id, userId: user.id },
    });

    if (!todo) {
      throw new ServerError('NOT_FOUND');
    }

    await db.delete(todos).where(q.eq(todos.id, todo.id));

    return;
  });
