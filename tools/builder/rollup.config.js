import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";
import typescript from "rollup-plugin-typescript2";

import setup from "./setup.cjs";

const baseBuild = {
  input: "./pkg.ts",
  plugins: [resolve(), commonjs() /* only for blake2b? */, typescript(), json()],
  treeshake: {
    moduleSideEffects: false,
  },
  external: ["lmdb", "@matrixai/quic", "node:fs", "node:assert", "node:os"],
};

export default [
  // ES Module build
  {
    ...baseBuild,
    output: {
      file: setup.cjsOutFile,
      format: "cjs",
    },
  },
  // Common JS build
  {
    ...baseBuild,
    output: {
      file: setup.esmOutFile,
      format: "es",
    },
  },
  {
    input: setup.typesInput,
    output: [{ file: setup.esmOutFile.replace(".js", ".d.ts"), format: "es" }],
    plugins: [
      dts({
        respectExternal: true,
        resolveJsonModule: true,
      }),
    ],
  },
];
