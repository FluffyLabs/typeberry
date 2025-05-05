import fs from "node:fs";
import type { ChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import type { State } from "@typeberry/state";
import { fullStateDumpFromJson } from "@typeberry/state-json";

export function loadGenesis(spec: ChainSpec, path: string): State {
  const genesisData = fs.readFileSync(path, "utf8");
  const genesisJson = JSON.parse(genesisData);
  return parseFromJson(genesisJson, fullStateDumpFromJson(spec));
}
