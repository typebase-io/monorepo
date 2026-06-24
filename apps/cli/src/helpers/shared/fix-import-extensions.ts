import { Project } from 'ts-morph';

import { isTsFile } from '#helpers/shared/is-ts-file.ts';
import { resolveRelativeImport } from '#helpers/shared/resolve-relative-import.ts';
import { walk } from '#helpers/shared/walk.ts';

export const fixImportExtensions = async (dirPath: string, ext: 'ts' | 'js') => {
  const files = await walk(dirPath, { recursive: true, filter: isTsFile });
  const project = new Project({ skipAddingFilesFromTsConfig: true });

  for (const filePath of files) {
    project.addSourceFileAtPath(filePath);
  }

  for (const sourceFile of project.getSourceFiles()) {
    let modified = false;

    for (const decl of [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()]) {
      const specifier = decl.getModuleSpecifierValue();

      if (!specifier || !specifier.startsWith('.') || /\.[mc]?[tj]sx?$/.test(specifier)) {
        continue;
      }

      const resolved = resolveRelativeImport(sourceFile.getFilePath(), specifier, ext);

      decl.setModuleSpecifier(resolved);

      modified = true;
    }

    if (modified) {
      await sourceFile.save();
    }
  }
};
