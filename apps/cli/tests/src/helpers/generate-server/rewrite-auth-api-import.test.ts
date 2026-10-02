import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { rewriteAuthApiImport } from '#helpers/generate-server/rewrite-auth-api-import.ts';

describe('rewriteAuthApiImport', () => {
  it.each([
    {
      name: 'createAuthMiddleware',
      source: 'import { createAuthMiddleware } from "typebase-io/server";',
      expected: 'import { createAuthMiddleware } from "better-auth/api";',
    },
    {
      name: 'AuthError, under its better-auth name',
      source: 'import { AuthError } from "typebase-io/server";',
      expected: 'import { APIError as AuthError } from "better-auth/api";',
    },
    {
      name: 'both, dropping defineAuth',
      source: 'import { AuthError, createAuthMiddleware, defineAuth } from "typebase-io/server";',
      expected: 'import { APIError as AuthError, createAuthMiddleware } from "better-auth/api";',
    },
    {
      name: 'aliases, keeping their local names',
      source: 'import { AuthError as Rejection, createAuthMiddleware as hook } from "typebase-io/server";',
      expected: 'import { APIError as Rejection, createAuthMiddleware as hook } from "better-auth/api";',
    },
    {
      name: 'a type-only import',
      source: 'import type { AuthError } from "typebase-io/server";',
      expected: 'import type { APIError as AuthError } from "better-auth/api";',
    },
    {
      name: 'the scoped package',
      source: 'import { createAuthMiddleware, defineAuth } from "@typebase-io/typebase/server";',
      expected: 'import { createAuthMiddleware } from "better-auth/api";',
    },
    {
      name: 'only defineAuth',
      source: 'import { defineAuth } from "typebase-io/server";',
      expected: '',
    },
    {
      name: 'names better-auth has no use for',
      source: 'import { defineEnv, ServerError } from "typebase-io/server";',
      expected: '',
    },
    {
      name: 'a namespace import',
      source: 'import * as typebase from "typebase-io/server";',
      expected: '',
    },
    {
      name: 'a default import',
      source: 'import typebase from "typebase-io/server";',
      expected: '',
    },
    {
      name: 'a side-effect import',
      source: 'import "typebase-io/server";',
      expected: '',
    },
  ])('rewrites $name', ({ source, expected }) => {
    const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true });
    const sourceFile = project.createSourceFile('auth.ts', source);

    rewriteAuthApiImport(sourceFile.getImportDeclarationOrThrow(() => true));

    expect(sourceFile.getFullText().trim()).toBe(expected);
  });
});
