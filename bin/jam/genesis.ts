import fs from "node:fs";
import type { Block } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import type { ChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import type { InMemoryState } from "@typeberry/state";
import { fullStateDumpFromJson } from "@typeberry/state-json";

export function loadGenesis(spec: ChainSpec, path: string): InMemoryState {
  const genesisData = fs.readFileSync(path, "utf8");
  const genesisJson = JSON.parse(genesisData);
  return parseFromJson(genesisJson, fullStateDumpFromJson(spec));
}

export function loadGenesisBlock(spec: ChainSpec, path: string): Block {
  const blockData = fs.readFileSync(path, "utf8");
  const blockJson = JSON.parse(blockData);
  return parseFromJson(blockJson, blockFromJson(spec));
}
