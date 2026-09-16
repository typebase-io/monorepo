import { type Comparison } from '#helpers/compare-docs/types.ts';

export const countDistinctChanges = (comparisons: Comparison[]) => {
  return new Set(comparisons.filter((entry) => entry.group !== undefined).map((entry) => entry.group)).size;
};
