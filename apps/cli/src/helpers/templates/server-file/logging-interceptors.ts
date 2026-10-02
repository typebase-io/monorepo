export const loggingInterceptors = `  interceptors: [
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
  ],`;
