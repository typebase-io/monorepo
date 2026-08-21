import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createPublisher } from '#server/publisher/create-publisher.ts';
import { definePublisher } from '#server/publisher/define-publisher.ts';
import { DatabasePublisher } from '#server/publisher/providers/db.ts';

import { fakePublisherDatabase } from '#tests/helpers/fake-publisher-database.ts';

const config = definePublisher({
  provider: 'db',
  options: { pollIntervalMs: 5 },
  events: { 'post.created': z.object({ id: z.number() }) },
});

describe('definePublisher', () => {
  it('describes the publisher without building one', () => {
    expect(config.provider).toBe('db');
    expect(config.options).toEqual({ pollIntervalMs: 5 });
    expect(Object.keys(config.events)).toEqual(['post.created']);
  });
});

describe('createPublisher', () => {
  it('builds the publisher a server runs from that description', () => {
    const { db } = fakePublisherDatabase();

    expect(createPublisher(config, { db })).toBeInstanceOf(DatabasePublisher);
  });

  it('publishes a payload the event schema accepts', async () => {
    const database = fakePublisherDatabase();
    const publisher = createPublisher(config, { db: database.db });

    await publisher.publish('post.created', { id: 1 });

    expect(database.rows).toEqual([{ id: 1, name: 'post.created', value: { id: 1 } }]);
  });

  it('refuses a payload the event schema rejects', async () => {
    const database = fakePublisherDatabase();
    const publisher = createPublisher(config, { db: database.db });

    await expect(publisher.publish('post.created', { id: 'nope' } as never)).rejects.toThrow(
      'The payload published as `post.created` does not match its schema.'
    );

    expect(database.rows).toEqual([]);
  });

  it('publishes what the schema parsed, not what was handed in', async () => {
    const database = fakePublisherDatabase();

    const publisher = createPublisher(definePublisher({ provider: 'db', events: { 'post.created': z.object({ id: z.coerce.number() }) } }), {
      db: database.db,
    });

    await publisher.publish('post.created', { id: '7' } as never);

    expect(database.rows[0]?.value).toEqual({ id: 7 });
  });

  it('passes an event with no schema through untouched', async () => {
    const database = fakePublisherDatabase();
    const publisher = new DatabasePublisher<{ 'post.created': { id: number } }>({ db: database.db });

    await publisher.publish('post.created', { id: 1 });

    expect(database.rows[0]?.value).toEqual({ id: 1 });
  });
});
