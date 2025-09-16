import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { AccumulationOutput } from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { AccumulateOutput } from "./accumulate-output.js";

describe("AccumulateOutput", () => {
  function prepareAccumulationOutput(length: number): AccumulationOutput[] {
    const output: AccumulationOutput[] = [];

    for (let i = 0; i < length; i++) {
      output.push(
        AccumulationOutput.create({
          serviceId: tryAsServiceId(i),
          output: Bytes.fill(HASH_SIZE, i).asOpaque(),
        }),
      );
    }

    return output;
  }

  it("should return empty hash when input is empty", async () => {
    const accumulateOutput = new AccumulateOutput();
    const accumulationOutputLog: AccumulationOutput[] = prepareAccumulationOutput(0);
    const expectedAccumulateRoot = Bytes.fill(HASH_SIZE, 0);

    const accumulateRoot = await accumulateOutput.transition({ accumulationOutputLog });

    deepEqual(accumulateRoot, expectedAccumulateRoot);
  });

  it("should return correct root hash when input is not empty", async () => {
    const accumulateOutput = new AccumulateOutput();
    const accumulationOutputLog: AccumulationOutput[] = prepareAccumulationOutput(10);
    const expectedAccumulateRoot = Bytes.parseBytes(
      "0x90328360e199f220b0efac00ec6f3a8511fe511ea0657374df04cc566664d29e",
      HASH_SIZE,
    );

    const accumulateRoot = await accumulateOutput.transition({ accumulationOutputLog });

    deepEqual(accumulateRoot, expectedAccumulateRoot);
  });
});
