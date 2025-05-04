import { fullChainSpec, tinyChainSpec } from "@typeberry/config";

export function getChainSpec(path: string) {
  if (path.includes("tiny")) {
    return tinyChainSpec;
  }

  return fullChainSpec;
}
