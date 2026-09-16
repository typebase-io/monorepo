import { type ComparedDiagnostic, type Diagnostic } from '#helpers/compare-docs/types.ts';

export const compareDiagnostics = (base: Diagnostic[], candidate: Diagnostic[]): ComparedDiagnostic[] => {
  const index = (entries: Diagnostic[]) =>
    new Map(entries.map((entry) => [JSON.stringify([entry.route, entry.profile, entry.state, entry.type, entry.message]), entry]));

  const left = index(base);
  const right = index(candidate);
  const results: ComparedDiagnostic[] = [];

  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const entry = right.get(key) ?? left.get(key);

    if (!entry) continue;

    results.push({ ...entry, status: left.has(key) ? (right.has(key) ? 'existing' : 'resolved') : 'new' });
  }

  return results;
};
