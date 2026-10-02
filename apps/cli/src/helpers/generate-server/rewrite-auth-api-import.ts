import { type ImportDeclaration } from 'ts-morph';

const BETTER_AUTH_API_NAMES: Record<string, string> = {
  createAuthMiddleware: 'createAuthMiddleware',
  AuthError: 'APIError',
};

export const rewriteAuthApiImport = (decl: ImportDeclaration) => {
  if (decl.getDefaultImport() || decl.getNamespaceImport()) {
    decl.remove();

    return;
  }

  for (const namedImport of decl.getNamedImports()) {
    const name = namedImport.getName();
    const betterAuthName = BETTER_AUTH_API_NAMES[name];

    if (betterAuthName === undefined) {
      namedImport.remove();
    } else if (betterAuthName !== name) {
      const localName = namedImport.getAliasNode()?.getText() ?? name;

      namedImport.setName(betterAuthName);
      namedImport.setAlias(localName);
    }
  }

  if (decl.getNamedImports().length === 0) {
    decl.remove();
  } else {
    decl.setModuleSpecifier('better-auth/api');
  }
};
