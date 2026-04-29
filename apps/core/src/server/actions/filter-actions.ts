type FilterActions<T> = {
  [K in keyof T as T[K] extends { '~orpc': unknown } ? K : never]: T[K];
};

export const filterActions = <T extends Record<string, unknown>>(module: T): FilterActions<T> => {
  return module as FilterActions<T>;
};
