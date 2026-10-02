import { describe, expect, it } from 'vitest';

import { loggingInterceptors } from '#helpers/templates/server-file/logging-interceptors.ts';

describe('loggingInterceptors', () => {
  it('records the action, its input and any error on the request log entry', () => {
    expect(loggingInterceptors).toBe(`  interceptors: [
    onError((error, { context }) => {
      const entry = logEntryOf(context);

      if (entry) {
        entry.error = error;
      }
    }),
  ],
  clientInterceptors: [
    ({ next, context, path, input }) => {
      const entry = logEntryOf(context);

      if (entry) {
        entry.action = path.join(".");
        entry.input = input;
      }

      return next();
    },
  ],`);
  });
});
