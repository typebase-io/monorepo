import { type InferSchemaOutput } from '@orpc/server';

import { type AnySchema } from '#server/actions/types.ts';
import { type PublisherProvider, type PublisherProviderOptions, type PublisherProviders } from '#server/publisher/providers/index.ts';

export interface PublisherConfig<
  TProvider extends PublisherProvider = PublisherProvider,
  TEvents extends Record<string, AnySchema> = Record<string, AnySchema>,
> {
  provider: TProvider;
  options?: PublisherProviderOptions[TProvider];
  events: TEvents;
}

export type InferPublisherEvents<TConfig> =
  TConfig extends PublisherConfig<PublisherProvider, infer TEvents> ? { [TName in keyof TEvents]: InferSchemaOutput<TEvents[TName]> } : never;

export type PublisherInstance<TConfig> =
  TConfig extends PublisherConfig<infer TProvider> ? PublisherProviders<InferPublisherEvents<TConfig>>[TProvider] : never;

export const definePublisher = <TProvider extends PublisherProvider, TEvents extends Record<string, AnySchema>>(
  config: PublisherConfig<TProvider, TEvents>
): PublisherConfig<TProvider, TEvents> => {
  return config;
};
