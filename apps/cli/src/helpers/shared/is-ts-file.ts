export const isTsFile = (filePath: string) => /\.(tsx?|mts|cts)$/.test(filePath) && !filePath.endsWith('.d.ts');
