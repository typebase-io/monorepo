export const tsConfigTemplate = (addWarning: boolean) => {
  let base = addWarning ? `// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT\n` : '';

  base += `{
  "compilerOptions": {
    "allowJs": true,
    "strict": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "target": "ESNext",
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["./_server"]
}`;

  return base;
};
