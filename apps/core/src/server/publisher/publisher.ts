export interface SubscribeOptions {
  signal?: AbortSignal | undefined;
  lastEventId?: string | undefined;
}

export abstract class Publisher<TEvents extends object> {
  abstract publish<TName extends keyof TEvents & string>(name: TName, value: TEvents[TName], options?: object): Promise<void>;

  abstract subscribe<TName extends keyof TEvents & string>(
    name: TName,
    options?: SubscribeOptions
  ): Promise<AsyncGenerator<TEvents[TName], void, void>>;
}
