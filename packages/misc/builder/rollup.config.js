import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";
import typescript from "rollup-plugin-typescript2";

import setup from "./setup.cjs";

const externalDeps = ["lmdb", "@matrixai/quic", "node:fs", "node:assert", "node:os", "@opentelemetry/api"];

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
  external: (id) => {
    return externalDeps.includes(id) || id.includes('@typeberry/')
  },
});

// Generate rollup config for all entry points
const configs = [];

for (const entry of setup.entries) {
  const baseBuild = createBaseBuild(entry.inputFile);

  // ES Module build
  configs.push({
    ...baseBuild,
    output: {
      file: entry.esmOutFile,
      format: "es",
    },
  });

  if (entry.esmOutFile.includes('index')) {
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

console.log(configs);

export default configs;
