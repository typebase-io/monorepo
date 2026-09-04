import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { rewriteImportExtensionsToJs } from '#helpers/shared/rewrite-import-extensions-to-js.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('rewriteImportExtensionsToJs', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('rewrites the .ts specifier of a relative import to .js', async () => {
    tmp.write('helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `import { x } from "./helper.ts";`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'relative-import.txt');
  });

  it('rewrites re-exports as well as imports', async () => {
    tmp.write('helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `export { x } from "./helper.ts";`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 're-export.txt');
  });

  it('rewrites files in nested folders', async () => {
    tmp.write('nested/helper.ts', 'export const x = 1;');
    tmp.write('nested/consumer.ts', `import { x } from "./helper.ts";`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('nested/consumer.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'relative-import.txt');
  });

  it('rewrites a dynamic import, which a host compiles by the same rule as a static one', async () => {
    tmp.write('helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `export const load = async () => import("./helper.ts");`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'dynamic-import.txt');
  });

  it('leaves bare (non-relative) imports untouched, so package names ending in .ts survive', async () => {
    tmp.write('index.ts', `import { z } from "some-package.ts";`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'bare-import.txt');
  });

  it('leaves specifiers that are already .js alone', async () => {
    tmp.write('index.ts', `import { x } from "./helper.js";`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'relative-import.txt');
  });

  it('leaves file paths that are not import specifiers alone', async () => {
    tmp.write('drizzle.config.ts', `export default { schema: "./src/db/schema.ts" };`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('drizzle.config.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'non-import-path.txt');
  });

  it('maps the module-flavoured extensions to their javascript counterparts', async () => {
    tmp.write('index.ts', `import { x } from "./esm.mts";\nimport { y } from "./cjs.cts";`);

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'module-extensions.txt');
  });

  it('leaves dynamic imports unchanged when they are packages, already JavaScript, or computed', async () => {
    tmp.write(
      'index.ts',
      `export const packageModule = import("some-package.ts");
export const jsModule = import("./helper.js");
export const extensionlessModule = import("./helper");
export const load = (specifier: string) => import(specifier);
export type Helper = import("./helper.js").Helper;`
    );

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'unchanged-dynamic-imports.txt');
  });

  it('leaves local exports without a module specifier unchanged', async () => {
    tmp.write('index.ts', 'const x = 1;\nexport { x };');

    await rewriteImportExtensionsToJs(tmp.path);

    expect(tmp.read('index.ts')).toEqualTemplate('rewrite-import-extensions-to-js', 'local-export.txt');
  });
});
