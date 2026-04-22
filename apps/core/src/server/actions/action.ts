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
} from '@orpc/server';

import { type ActionWithInput, type ActionWithOutput, type AnySchema } from '#server/actions/types.ts';

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

  constructor(
    os:
      | Builder<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>
      | BuilderWithMiddlewares<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>
  ) {
    this.#os = os;
  }

  input<USchema extends AnySchema>(schema: USchema): ActionWithInput<TInitialContext, TCurrentContext, USchema, TOutputSchema, TErrorMap, TMeta> {
    return new Action(this.#os.input(schema) as any) as any;
  }

  output<USchema extends AnySchema>(schema: USchema): ActionWithOutput<TInitialContext, TCurrentContext, TInputSchema, USchema, TErrorMap, TMeta> {
    return new Action(this.#os.output(schema) as any) as any;
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

    return new Action(updatedOS) as any;
  }

  handler<UFuncOutput>(
    fn: (context: TCurrentContext) => Promise<UFuncOutput>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, Schema<UFuncOutput, UFuncOutput>, TErrorMap, TMeta> {
    return this.#os.handler(({ context, input }) => fn({ ...context, input }));
  }
}
