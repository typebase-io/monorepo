import { editTsFiles } from '#helpers/shared/edit-ts-files.ts';
import { resolveRelativeImport } from '#helpers/shared/resolve-relative-import.ts';

export const fixImportExtensions = async (dirPath: string, ext: 'ts' | 'js') =>
  editTsFiles(dirPath, (sourceFile) => {
    let modified = false;

    for (const decl of [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()]) {
      const specifier = decl.getModuleSpecifierValue();

      if (!specifier || !specifier.startsWith('.') || /\.[mc]?[tj]sx?$/.test(specifier)) {
        continue;
      }

      decl.setModuleSpecifier(resolveRelativeImport(sourceFile.getFilePath(), specifier, ext));

      modified = true;
    }

    return modified;
  });
