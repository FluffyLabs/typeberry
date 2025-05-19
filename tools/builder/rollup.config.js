import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";
import typescript from "rollup-plugin-typescript2";

import setup from "./setup.cjs";

export default [
  {
    input: "./pkg.ts",
    output: {
      file: setup.outFile,
      format: "cjs",
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript(),
    ],
    treeshake: {
      moduleSideEffects: false,
    },
  },
  {
    input: setup.typesInput,
    output: [{ file: setup.outFile.replace(".js", ".d.ts"), format: "es" }],
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
  },
];
