import path from 'node:path';

export const stripExtension = (filePath: string) => path.normalize(filePath).replace(/(\.d)?\.[mc]?[tj]sx?$/, '');
