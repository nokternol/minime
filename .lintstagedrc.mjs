// lint-staged runs checks scoped to staged files only.
// Biome handles format+lint per-file (fast).
// TypeScript checks run per-package when any TS/Svelte file in that package is staged.
// Tests are left to CI — too slow for pre-commit.
export default {
  // Biome: format + lint on staged TS/Svelte/CSS files (excludes lockfiles/json)
  '**/*.{ts,js,svelte,css}': (files) =>
    `npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${files.join(' ')}`,

  // TypeScript typecheck for api — runs project-wide (ignores file list)
  'apps/api/**/*.ts': () => 'npm --workspace=@minime/api run typecheck',

  // TypeScript typecheck for web — includes svelte-kit sync (ignores file list)
  'apps/web/**/*.{ts,svelte}': () => 'npm --workspace=@minime/web run typecheck',
};
