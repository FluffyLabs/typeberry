import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "rollup-plugin-typescript2";

import outFile from "./setup.cjs";

export default {
  input: "./pkg.ts",
  output: {
    file: outFile,
    format: "cjs",
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    replace({
      preventAssignment: true,
      values: {
        __filename: JSON.stringify("<unknown>"),
      },
    }),
  ],
};
