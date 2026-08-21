import { type PublisherConfig, type PublisherInstance } from '#server/publisher/define-publisher.ts';
import { type PublisherProviderResources, publisherFactories } from '#server/publisher/providers/index.ts';

export const createPublisher = <TConfig extends PublisherConfig>(
  config: TConfig,
  resources: PublisherProviderResources[TConfig['provider']]
): PublisherInstance<TConfig> => {
  return publisherFactories[config.provider](config, resources) as unknown as PublisherInstance<TConfig>;
};
