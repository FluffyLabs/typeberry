import assert from "node:assert";
import { describe, it } from "node:test";
import { BANDERSNATCH_KEY_BYTES, ED25519_KEY_BYTES, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/safrole";
import { BLS_KEY_BYTES } from "@typeberry/safrole/crypto";
import { HostCallResult } from "../results";
import { Designate } from "./designate";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const VALIDATORS_DATA_START_REG = 7;

function prepareRegsAndMemory(
  validators: ValidatorData[],
  { skipValidators = false }: { skipValidators?: boolean } = {},
) {
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[VALIDATORS_DATA_START_REG] = memStart;

  const builder = new MemoryBuilder();

  while (validators.length < tinyChainSpec.validatorsCount) {
    validators.push(
      ValidatorData.fromCodec({
        ed25519: Bytes.fill(ED25519_KEY_BYTES, 0).asOpaque(),
        bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, 0).asOpaque(),
        bls: Bytes.fill(BLS_KEY_BYTES, 0).asOpaque(),
        metadata: Bytes.fill(VALIDATOR_META_BYTES, 0),
      }),
    );
  }

  const encoder = Encoder.create();
  encoder.sequenceFixLen(ValidatorData.Codec, validators);
  const data = encoder.viewResult();

  if (!skipValidators) {
    builder.setReadable(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + data.raw.length), data.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Designate", () => {
  it("should fail when no data in memory", async () => {
    const accumulate = new TestAccumulate();
    const designate = new Designate(accumulate, tinyChainSpec);
    const serviceId = tryAsServiceId(10_000);
    designate.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory([], { skipValidators: true });

    // when
    await designate.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accumulate.validatorsData.length, 0);
  });

  it("should designate new validator set", async () => {
    const accumulate = new TestAccumulate();
    const designate = new Designate(accumulate, tinyChainSpec);
    const serviceId = tryAsServiceId(10_000);
    designate.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory([
      ValidatorData.fromCodec({
        ed25519: Bytes.fill(ED25519_KEY_BYTES, 1).asOpaque(),
        bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, 1).asOpaque(),
        bls: Bytes.fill(BLS_KEY_BYTES, 1).asOpaque(),
        metadata: Bytes.fill(VALIDATOR_META_BYTES, 1),
      }),
      ValidatorData.fromCodec({
        ed25519: Bytes.fill(ED25519_KEY_BYTES, 2).asOpaque(),
        bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, 2).asOpaque(),
        bls: Bytes.fill(BLS_KEY_BYTES, 2).asOpaque(),
        metadata: Bytes.fill(VALIDATOR_META_BYTES, 2),
      }),
    ]);

    // when
    await designate.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
    assert.deepStrictEqual(
      accumulate.validatorsData[0][0].toString(),
      `ValidatorData {
  ed25519: 0x0101010101010101010101010101010101010101010101010101010101010101
  bandersnatch: 0x0101010101010101010101010101010101010101010101010101010101010101
  bls: 0x010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101
  metadata: 0x0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101
}`,
    );
    assert.deepStrictEqual(
      accumulate.validatorsData[0][1].toString(),
      `ValidatorData {
  ed25519: 0x0202020202020202020202020202020202020202020202020202020202020202
  bandersnatch: 0x0202020202020202020202020202020202020202020202020202020202020202
  bls: 0x020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202
  metadata: 0x0202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202
}`,
    );
    assert.deepStrictEqual(accumulate.validatorsData[0].length, tinyChainSpec.validatorsCount);
    assert.deepStrictEqual(accumulate.validatorsData.length, 1);
  });
});
