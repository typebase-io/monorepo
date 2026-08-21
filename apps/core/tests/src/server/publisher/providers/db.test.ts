import { getEventMeta } from '@orpc/server';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { DatabasePublisher, eventsTable } from '#server/publisher/providers/db.ts';

import { fakePublisherDatabase } from '#tests/helpers/fake-publisher-database.ts';

interface Events {
  'post.created': { id: number };
  'post.removed': { id: number };
}

const createPublisher = (options: { maxBufferedEvents?: number } = {}) => {
  const database = fakePublisherDatabase();
  const publisher = new DatabasePublisher<Events>({ db: database.db, pollIntervalMs: 1, ...options });

  return { publisher, database };
};

const take = async <T>(iterator: AsyncGenerator<T>, count: number) => {
  const received: T[] = [];

  for await (const event of iterator) {
    received.push(event);

    if (received.length === count) {
      break;
    }
  }

  return received;
};

const waitFor = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 200 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

describe('DatabasePublisher', () => {
  it('writes the event wherever the given transaction writes', async () => {
    const database = fakePublisherDatabase();
    const transaction = fakePublisherDatabase();
    const publisher = new DatabasePublisher<Events>({ db: database.db, pollIntervalMs: 1 });

    await publisher.publish('post.created', { id: 1 }, { tx: transaction.db });

    expect(transaction.rows).toEqual([{ id: 1, name: 'post.created', value: { id: 1 } }]);
    expect(database.rows).toEqual([]);
  });

  it('writes on its own connection when no transaction is given', async () => {
    const database = fakePublisherDatabase();
    const publisher = new DatabasePublisher<Events>({ db: database.db, pollIntervalMs: 1 });

    await publisher.publish('post.created', { id: 1 });

    expect(database.rows).toEqual([{ id: 1, name: 'post.created', value: { id: 1 } }]);
  });

  it('delivers what is published after a subscriber joins', async () => {
    const { publisher } = createPublisher();
    const iterator = await publisher.subscribe('post.created');

    const received = take(iterator, 2);

    await publisher.publish('post.created', { id: 1 });
    await publisher.publish('post.created', { id: 2 });

    await expect(received).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('starts from the end of the table, so a new subscriber gets no history', async () => {
    const { publisher } = createPublisher();

    await publisher.publish('post.created', { id: 1 });

    const iterator = await publisher.subscribe('post.created');
    const received = take(iterator, 1);

    await publisher.publish('post.created', { id: 2 });

    await expect(received).resolves.toEqual([{ id: 2 }]);
  });

  it('replays from lastEventId when a client reconnects', async () => {
    const { publisher } = createPublisher();

    await publisher.publish('post.created', { id: 1 });
    await publisher.publish('post.created', { id: 2 });
    await publisher.publish('post.created', { id: 3 });

    const received = await take(await publisher.subscribe('post.created', { lastEventId: '1' }), 2);

    expect(received).toEqual([{ id: 2 }, { id: 3 }]);
  });

  it('only delivers the event a subscriber asked for', async () => {
    const { publisher } = createPublisher();
    const iterator = await publisher.subscribe('post.removed');

    const received = take(iterator, 1);

    await publisher.publish('post.created', { id: 1 });
    await publisher.publish('post.removed', { id: 2 });

    await expect(received).resolves.toEqual([{ id: 2 }]);
  });

  it('tags each event with its row id, so the client can resume', async () => {
    const { publisher } = createPublisher();
    const iterator = await publisher.subscribe('post.created');

    const received = take(iterator, 1);

    await publisher.publish('post.created', { id: 1 });

    const [event] = await received;

    expect(getEventMeta(event)).toEqual({ id: '1' });
  });

  it('polls once for every subscriber on the instance', async () => {
    const { publisher, database } = createPublisher();

    const first = take(await publisher.subscribe('post.created'), 1);
    const second = take(await publisher.subscribe('post.created'), 1);
    const third = take(await publisher.subscribe('post.created'), 1);

    await waitFor(() => database.selectCount > 6);

    const before = database.selectCount;

    await publisher.publish('post.created', { id: 1 });
    await Promise.all([first, second, third]);

    expect(database.selectCount - before).toBeLessThan(6);
  });

  it('stops polling once the last subscriber leaves', async () => {
    const { publisher, database } = createPublisher();
    const iterator = await publisher.subscribe('post.created');

    const received = take(iterator, 1);

    await publisher.publish('post.created', { id: 1 });
    await received;

    await waitFor(() => false);

    const settled = database.selectCount;

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(database.selectCount).toBe(settled);
  });

  it('ends the stream when the signal aborts', async () => {
    const { publisher } = createPublisher();
    const controller = new AbortController();
    const iterator = await publisher.subscribe('post.created', { signal: controller.signal });

    const received: unknown[] = [];
    const consumed = (async () => {
      for await (const event of iterator) {
        received.push(event);
      }
    })();

    await publisher.publish('post.created', { id: 1 });
    await waitFor(() => received.length === 1);

    controller.abort();

    await expect(consumed).resolves.toBeUndefined();
    expect(received).toEqual([{ id: 1 }]);
  });

  it('starts from zero when the database hands back no row at all', async () => {
    const database = fakePublisherDatabase();

    const db = {
      ...database.db,
      select: (columns: Record<string, unknown>) =>
        Object.keys(columns).length === 1
          ? { from: () => Promise.resolve([]) }
          : (database.db as { select: (c: unknown) => unknown }).select(columns),
    } as unknown as typeof database.db;

    const publisher = new DatabasePublisher<Events>({ db, pollIntervalMs: 1 });

    await publisher.publish('post.created', { id: 1 });

    await expect(take(await publisher.subscribe('post.created'), 1)).resolves.toEqual([{ id: 1 }]);
  });

  it('keeps events it could not buffer instead of dropping them', async () => {
    const { publisher } = createPublisher({ maxBufferedEvents: 1 });
    const iterator = await publisher.subscribe('post.created');

    const received = take(iterator, 3);

    await publisher.publish('post.created', { id: 1 });
    await publisher.publish('post.created', { id: 2 });
    await publisher.publish('post.created', { id: 3 });

    await expect(received).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
});

describe('the events table it reads and writes', () => {
  const config = getTableConfig(eventsTable);

  it('is the `events` table a project keeps its events in', () => {
    expect(config.name).toBe('events');
  });

  it('holds the columns an event is made of', () => {
    expect(config.columns.map((column) => [column.name, column.getSQLType(), column.notNull])).toEqual([
      ['id', 'bigint', true],
      ['name', 'text', true],
      ['value', 'jsonb', true],
      ['created_at', 'timestamp with time zone', true],
    ]);
  });

  it('indexes the name and id together, which is the order every poll reads them in', () => {
    expect(config.indexes.map((index) => [index.config.name, index.config.columns.map((column) => 'name' in column && column.name)])).toEqual([
      ['events_name_id_idx', ['name', 'id']],
    ]);
  });
});
