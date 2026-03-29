import { Block, reencodeAsView } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { json, parseFromJson } from "@typeberry/json-parser";
import { getExtrinsicFromJson } from "./extrinsic.js";
import { headerFromJson } from "./header.js";

export const blockFromJson = (spec: ChainSpec) =>
  json.object<Block>(
    {
      header: headerFromJson,
      extrinsic: getExtrinsicFromJson(spec),
    },
    ({ header, extrinsic }) => Block.create({ header, extrinsic }),
  );

export const blockViewFromJson = (spec: ChainSpec) => {
  const parseBlock = blockFromJson(spec);
  return json.fromAny((p) => {
    const block = parseFromJson(p, parseBlock);
    return reencodeAsView(Block.Codec, block, spec);
  });
};
