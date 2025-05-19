import type { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";

import { Block } from "@typeberry/block";
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
