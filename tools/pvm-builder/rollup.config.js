import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "./index.ts",
  output: {
    file: "../../dist/pvm/pvm.js",
    format: "cjs",
  },
  plugins: [resolve(), commonjs(), typescript()],
};
