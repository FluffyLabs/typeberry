// @ts-check

import * as pluginImport from "eslint-plugin-import";
import tseslint from "typescript-eslint";

const baseImport = pluginImport.flatConfigs?.recommended;

export default tseslint.config(
  tseslint.configs.base,
  { plugins: baseImport.plugins },
  {
    files: ["**/*.ts"],
    ignores: ["dist/**"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "import/no-extraneous-dependencies": "error",
    },
  },
);
