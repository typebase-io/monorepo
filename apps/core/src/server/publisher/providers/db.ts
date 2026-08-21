import { withEventMeta } from '@orpc/server';
import { type AnyRelations, asc, gt, sql } from 'drizzle-orm';

import { p } from '#db/drizzle.ts';

import { type AnySchema, type DB } from '#server/actions/types.ts';
import { ServerError } from '#server/error/index.ts';
import { Publisher, type SubscribeOptions } from '#server/publisher/publisher.ts';

export const eventsTable = p.pgTable(
  'events',
  {
    id: p.bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: p.text().notNull(),
    value: p.jsonb().notNull(),
    createdAt: p.timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [p.index('events_name_id_idx').on(table.name, table.id)]
);

export type PublisherDatabase = Pick<DB<AnyRelations>, 'insert' | 'select'>;

export interface DatabasePublisherOptions {
  pollIntervalMs?: number;
  maxBufferedEvents?: number;
  batchSize?: number;
}

interface Subscriber {
  name: string;
  cursor: number;
  queue: { id: number; value: unknown }[];
  wake: (() => void) | undefined;
}

export class DatabasePublisher<TEvents extends object> extends Publisher<TEvents> {
  #db: PublisherDatabase;
  #schemas: Record<string, AnySchema>;
  #pollIntervalMs: number;
  #maxBufferedEvents: number;
  #batchSize: number;
  #subscribers = new Set<Subscriber>();
  #isPolling = false;

  constructor({
    db,
    events: schemas = {},
    pollIntervalMs = 1000,
    maxBufferedEvents = 100,
    batchSize = 100,
  }: {
    db: PublisherDatabase;
    events?: Record<string, AnySchema>;
    pollIntervalMs?: number;
    maxBufferedEvents?: number;
    batchSize?: number;
  }) {
    super();

    this.#db = db;
    this.#schemas = schemas;
    this.#pollIntervalMs = pollIntervalMs;
    this.#maxBufferedEvents = maxBufferedEvents;
    this.#batchSize = batchSize;
  }

  async publish<TName extends keyof TEvents & string>(name: TName, value: TEvents[TName], { tx }: { tx?: PublisherDatabase } = {}) {
    await (tx ?? this.#db).insert(eventsTable).values({ name, value: await this.#validate(name, value) });
  }

  async #validate(name: string, value: unknown): Promise<unknown> {
    const schema = this.#schemas[name];

    if (!schema) {
      return value;
    }

    const result = await schema['~standard'].validate(value);

    if (result.issues) {
      throw new ServerError('INTERNAL_SERVER_ERROR', { message: `The payload published as \`${name}\` does not match its schema.` });
    }

    return result.value;
  }

  async subscribe<TName extends keyof TEvents & string>(
    name: TName,
    { signal, lastEventId }: SubscribeOptions = {}
  ): Promise<AsyncGenerator<TEvents[TName], void, void>> {
    const cursor = lastEventId === undefined ? await this.#getLatestId() : Number(lastEventId);
    const subscriber: Subscriber = { name, cursor, queue: [], wake: undefined };

    this.#subscribers.add(subscriber);
    this.#startPolling();

    return this.#iterate<TName>(subscriber, signal);
  }

  async *#iterate<TName extends keyof TEvents & string>(subscriber: Subscriber, signal: AbortSignal | undefined): AsyncGenerator<TEvents[TName]> {
    try {
      while (signal?.aborted !== true) {
        const event = subscriber.queue.shift();

        if (event === undefined) {
          await this.#waitForEvent(subscriber, signal);

          continue;
        }

        yield withEventMeta(event.value as TEvents[TName] & object, { id: String(event.id) });
      }
    } finally {
      this.#subscribers.delete(subscriber);
    }
  }

  async #getLatestId(): Promise<number> {
    const [latest] = await this.#db.select({ id: sql<string | number>`coalesce(max(${eventsTable.id}), 0)` }).from(eventsTable);

    return Number(latest?.id ?? 0);
  }

  #startPolling(): void {
    if (this.#isPolling) {
      return;
    }

    this.#isPolling = true;

    void this.#poll().finally(() => {
      this.#isPolling = false;
    });
  }

  async #poll(): Promise<void> {
    for (let subscribers = [...this.#subscribers]; subscribers.length > 0; subscribers = [...this.#subscribers]) {
      await this.#dispatch(subscribers);
      await new Promise((resolve) => setTimeout(resolve, this.#pollIntervalMs));
    }
  }

  async #dispatch(subscribers: Subscriber[]): Promise<void> {
    const from = Math.min(...subscribers.map((subscriber) => subscriber.cursor));

    const rows = await this.#db
      .select({ id: eventsTable.id, name: eventsTable.name, value: eventsTable.value })
      .from(eventsTable)
      .where(gt(eventsTable.id, from))
      .orderBy(asc(eventsTable.id))
      .limit(this.#batchSize);

    for (const subscriber of subscribers) {
      for (const row of rows) {
        if (subscriber.queue.length >= this.#maxBufferedEvents) {
          break;
        }

        if (row.id <= subscriber.cursor) {
          continue;
        }

        subscriber.cursor = row.id;

        if (row.name === subscriber.name) {
          subscriber.queue.push({ id: row.id, value: row.value });
        }
      }

      subscriber.wake?.();
    }
  }

  #waitForEvent(subscriber: Subscriber, signal: AbortSignal | undefined): Promise<void> {
    return new Promise<void>((resolve) => {
      const done = () => {
        subscriber.wake = undefined;
        signal?.removeEventListener('abort', done);
        resolve();
      };

      subscriber.wake = done;
      signal?.addEventListener('abort', done, { once: true });
    });
  }
}
