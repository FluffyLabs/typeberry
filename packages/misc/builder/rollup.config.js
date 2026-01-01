import fs from "node:fs";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";
import typescript from "rollup-plugin-typescript2";

import setup from "./setup.cjs";

const externalDeps = ["lmdb", "@matrixai/quic", "node:fs", "node:assert", "node:os"];

// Mark all @typeberry/* packages as external to avoid bundling them
const isExternal = (id) => {
  return (
    externalDeps.includes(id) ||
    (id.startsWith("@typeberry/") && !id.startsWith("@typeberry/native")) ||
    id.startsWith("node:")
  );
};

const createBaseBuild = (inputFile) => ({
  input: inputFile,
  plugins: [
    resolve({
      preferBuiltins: false,
    }),
    commonjs() /* only for blake2b? */,
    typescript(),
    json(),
  ],
  treeshake: {
    moduleSideEffects: false,
  },
  external: isExternal,
});

// Generate rollup config for all entry points
const configs = [];

for (const entry of setup.entries) {
  const baseBuild = createBaseBuild(entry.inputFile);

  // CommonJS build
  configs.push({
    ...baseBuild,
    output: {
      file: entry.cjsOutFile,
      format: "cjs",
    },
  });

  // ES Module build
  configs.push({
    ...baseBuild,
    output: {
      file: entry.esmOutFile,
      format: "es",
    },
  });

  // TypeScript declarations (skip for subpaths, already generated)
  if (!entry.skipDts) {
    configs.push({
      input: entry.typesInput,
      output: [{ file: entry.esmOutFile.replace(".mjs", ".d.ts"), format: "es" }],
      plugins: [
        dts({
          respectExternal: true,
          resolveJsonModule: true,
        }),
      ],
    });
  }
}

// Rollup requires at least one config
// If we have no configs (all subpaths generated directly by setup.cjs),
// we still need a dummy config to satisfy rollup's requirement
if (configs.length === 0) {
  // Create a minimal dummy input file
  const dummyInput = `${setup.DIST}/.noop.js`;
  fs.writeFileSync(dummyInput, "// No-op\nexport {};\n");

  configs.push({
    input: dummyInput,
    output: {
      file: `${setup.DIST}/.noop.out.js`,
      format: "es",
    },
  });
}

export default configs;
