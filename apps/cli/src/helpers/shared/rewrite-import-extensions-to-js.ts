import { SyntaxKind } from 'ts-morph';

import { editTsFiles } from '#helpers/shared/edit-ts-files.ts';

export const rewriteImportExtensionsToJs = async (dirPath: string) =>
  editTsFiles(dirPath, (sourceFile) => {
    let modified = false;

    for (const decl of [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()]) {
      const specifier = decl.getModuleSpecifierValue();

      if (specifier === undefined) {
        continue;
      }

      const jsSpecifier = specifier.startsWith('.')
        ? specifier
            .replace(/\.tsx?$/, '.js')
            .replace(/\.mts$/, '.mjs')
            .replace(/\.cts$/, '.cjs')
        : specifier;

      if (jsSpecifier === specifier) {
        continue;
      }

      decl.setModuleSpecifier(jsSpecifier);

      modified = true;
    }

    for (const importKeyword of sourceFile.getDescendantsOfKind(SyntaxKind.ImportKeyword)) {
      const arg = importKeyword.getParentIfKind(SyntaxKind.CallExpression)?.getArguments()[0]?.asKind(SyntaxKind.StringLiteral);
      const specifier = arg?.getLiteralValue();

      if (arg === undefined || specifier === undefined) {
        continue;
      }

      const jsSpecifier = specifier.startsWith('.')
        ? specifier
            .replace(/\.tsx?$/, '.js')
            .replace(/\.mts$/, '.mjs')
            .replace(/\.cts$/, '.cjs')
        : specifier;

      if (jsSpecifier === specifier) {
        continue;
      }

      arg.setLiteralValue(jsSpecifier);

      modified = true;
    }

    return modified;
  });
