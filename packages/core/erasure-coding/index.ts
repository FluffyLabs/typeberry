import { init } from "@typeberry/native";

export * from "./erasure-coding.js";
export const initEc = async () => {
  await init.reedSolomon();
};
