import { type AnySchema } from '#server/actions/types.ts';
import { DatabasePublisher, type DatabasePublisherOptions, type PublisherDatabase } from '#server/publisher/providers/db.ts';

export interface PublisherProviders<TEvents extends object> {
  db: DatabasePublisher<TEvents>;
}

export interface PublisherProviderOptions {
  db: DatabasePublisherOptions;
}

export interface PublisherProviderResources {
  db: { db: PublisherDatabase };
}

export type PublisherProvider = keyof PublisherProviders<never>;

type PublisherFactory = (
  config: { events: Record<string, AnySchema>; options?: PublisherProviderOptions[PublisherProvider] },
  resources: PublisherProviderResources[PublisherProvider]
) => PublisherProviders<never>[PublisherProvider];

export const publisherFactories: Record<PublisherProvider, PublisherFactory> = {
  db: (config, { db }) => new DatabasePublisher({ db, events: config.events, ...config.options }),
};
