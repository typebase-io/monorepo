/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type Builder,
  type BuilderWithMiddlewares,
  type Context,
  type DecoratedProcedure,
  type ErrorMap,
  type IntersectPick,
  type MergedCurrentContext,
  type MergedInitialContext,
  type Meta,
  type Schema,
  eventIterator,
} from '@orpc/server';

import {
  type ActionWithInput,
  type ActionWithOutput,
  type AnyEventIterator,
  type AnySchema,
  type EventIteratorParams,
  type MustYield,
} from '#server/actions/types.ts';

interface SchemaBuilder {
  handler: (fn: (options: { context: any; input: any; lastEventId: string | undefined; signal: AbortSignal | undefined }) => unknown) => any;
  output: (schema: AnySchema) => SchemaBuilder;
}

export class Action<
  TInitialContext extends Context,
  TCurrentContext extends Context,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TErrorMap extends ErrorMap,
  TMeta extends Meta,
> {
  #os:
    | Builder<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>
    | BuilderWithMiddlewares<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>;

  #outputSchema: AnySchema | undefined;

  constructor(
    os:
      | Builder<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>
      | BuilderWithMiddlewares<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>,
    outputSchema?: AnySchema
  ) {
    this.#os = os;
    this.#outputSchema = outputSchema;
  }

  input<USchema extends AnySchema>(schema: USchema): ActionWithInput<TInitialContext, TCurrentContext, USchema, TOutputSchema, TErrorMap, TMeta> {
    return new Action(this.#os.input(schema) as any, this.#outputSchema) as any;
  }

  output<USchema extends AnySchema>(schema: USchema): ActionWithOutput<TInitialContext, TCurrentContext, TInputSchema, USchema, TErrorMap, TMeta> {
    return new Action(this.#os as any, schema) as any;
  }

  use<UOutContext extends IntersectPick<TCurrentContext, UOutContext>, UInContext extends Context = TCurrentContext>(
    fn: (ctx: TCurrentContext) => Promise<UOutContext> | UOutContext
  ): Action<
    MergedInitialContext<TInitialContext, UInContext, TCurrentContext>,
    MergedCurrentContext<TCurrentContext, UOutContext>,
    TInputSchema,
    TOutputSchema,
    TErrorMap,
    TMeta
  > {
    const updatedOS = this.#os.use(async ({ context, next }) => {
      const newCtx = await fn(context);

      return next({
        context: newCtx,
      });
    }) as any;

    return new Action(updatedOS, this.#outputSchema) as any;
  }

  handler<UFuncOutput>(
    fn: (context: TCurrentContext) => Promise<UFuncOutput>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, Schema<UFuncOutput, UFuncOutput>, TErrorMap, TMeta> {
    const builder = this.#os as unknown as SchemaBuilder;
    const os = this.#outputSchema ? builder.output(this.#outputSchema) : builder;

    return os.handler(({ context, input }) => fn({ ...context, input }));
  }

  stream<UFuncOutput extends AnyEventIterator>(
    fn: (context: TCurrentContext & EventIteratorParams) => UFuncOutput & MustYield<UFuncOutput>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, Schema<UFuncOutput, UFuncOutput>, TErrorMap, TMeta> {
    const builder = this.#os as unknown as SchemaBuilder;
    const os = this.#outputSchema ? builder.output(eventIterator(this.#outputSchema)) : builder;

    return os.handler(({ context, input, lastEventId, signal }) => fn({ ...context, input, lastEventId, signal }));
  }
}
