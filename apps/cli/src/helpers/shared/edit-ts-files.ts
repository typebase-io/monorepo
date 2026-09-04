import { Project, type SourceFile } from 'ts-morph';

import { isTsFile } from '#helpers/shared/is-ts-file.ts';
import { walk } from '#helpers/shared/walk.ts';

export const editTsFiles = async (dirPath: string, edit: (sourceFile: SourceFile) => boolean) => {
  const files = await walk(dirPath, { recursive: true, filter: isTsFile });
  const project = new Project({ skipAddingFilesFromTsConfig: true });

  for (const filePath of files) {
    project.addSourceFileAtPath(filePath);
  }

  for (const sourceFile of project.getSourceFiles()) {
    if (edit(sourceFile)) {
      await sourceFile.save();
    }
  }
};
