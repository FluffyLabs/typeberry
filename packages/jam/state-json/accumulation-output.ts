import { fromJson } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";
import { AccumulationOutput } from "@typeberry/state/accumulation-output.js";

export const accumulationOutput = json.object<AccumulationOutput>(
  {
    serviceId: "number",
    output: fromJson.bytes32(),
  },
  ({ serviceId, output }) => AccumulationOutput.create({ serviceId, output }),
);
