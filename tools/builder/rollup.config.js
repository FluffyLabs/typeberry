import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

import outFile from "./setup.cjs";

export default {
  input: "./pkg.ts",
  output: {
    file: outFile,
    format: "cjs",
  },
  plugins: [resolve(), commonjs(), typescript()],
};
