import { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";

import { getExtrinsicFromJson } from "./extrinsic";
import { headerFromJson } from "./header";
import {Block} from "@typeberry/block";

export const blockFromJson = (spec: ChainSpec) => json.object<Block>(
  {
    header: headerFromJson,
    extrinsic: getExtrinsicFromJson(spec),
  },
  ({ header, extrinsic }) => new Block(header, extrinsic),
);


