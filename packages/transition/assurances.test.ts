import { describe, it } from "node:test";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  ED25519_KEY_BYTES,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsPerCore,
  tryAsPerValidator,
  tryAsTimeSlot,
} from "@typeberry/block";
import {
  type AssurancesExtrinsicView,
  type AvailabilityAssurance,
  assurancesExtrinsicCodec,
} from "@typeberry/block/assurances";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { asOpaqueType } from "@typeberry/utils";
import { Assurances, type AssurancesInput } from "./assurances";

function assurancesAsView(spec: ChainSpec, assurances: AvailabilityAssurance[]): AssurancesExtrinsicView {
  const encoded = Encoder.encodeObject(assurancesExtrinsicCodec, asOpaqueType(assurances), spec);
  return Decoder.decodeObject(assurancesExtrinsicCodec.View, encoded, spec);
}

describe("Assurances", () => {
  it("should perform a transition with empty state", async () => {
    const assurances = new Assurances(tinyChainSpec, {
      availabilityAssignment: tryAsPerCore([null, null], tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });

    const input: AssurancesInput = {
      parentHash: Bytes.parseBytes(
        "0xd61a38a0f73beda90e8c1dfba731f65003742539f4260694f44e22cabef24a8e",
        HASH_SIZE,
      ).asOpaque(),
      slot: tryAsTimeSlot(12),
      assurances: assurancesAsView(tinyChainSpec, []),
    };

    const res = await assurances.transition(input);
  });
});

function createValidatorData({ bandersnatch, ed25519 }: { bandersnatch: string; ed25519: string }): ValidatorData {
  return ValidatorData.fromCodec({
    ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
    bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
    bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  });
}
const VALIDATORS: ValidatorData[] = [
  {
    bandersnatch: "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
    ed25519: "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
  },
  {
    bandersnatch: "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
    ed25519: "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
  },
  {
    bandersnatch: "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
    ed25519: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
  },
  {
    bandersnatch: "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
    ed25519: "0xb3e0e096b02e2ec98a3441410aeddd78c95e27a0da6f411a09c631c0f2bea6e9",
  },
  {
    bandersnatch: "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
    ed25519: "0x5c7f34a4bd4f2d04076a8c6f9060a0c8d2c6bdd082ceb3eda7df381cb260faff",
  },
  {
    bandersnatch: "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
    ed25519: "0x837ce344bc9defceb0d7de7e9e9925096768b7adb4dad932e532eb6551e0ea02",
  },
].map(createValidatorData);
