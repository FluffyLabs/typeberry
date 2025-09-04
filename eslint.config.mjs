// @ts-check

import * as pluginImport from "eslint-plugin-import";
import tseslint from "typescript-eslint";

const baseImport = pluginImport.flatConfigs?.recommended;

export default tseslint.config(
  tseslint.configs.base,
  { plugins: baseImport.plugins },
  {
    files: ["**/*.ts"],
    ignores: ["dist/*", "dist/**", "tools/builder/pkg.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-unused-expressions": "error",
      "import/no-extraneous-dependencies": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableObject: false,
          allowNullableNumber: false,
          allowString: false,
        },
      ],
      "import/no-relative-packages": "error",
    },
  },
);
