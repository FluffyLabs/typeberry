import assert from "node:assert";
import { describe, it } from "node:test";
import {
  EpochMarker,
  Header,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsTimeSlot,
  tryAsValidatorIndex,
  ValidatorKeys,
} from "@typeberry/block";
import { Ticket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES } from "@typeberry/crypto";
import { BANDERSNATCH_VRF_SIGNATURE_BYTES } from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { BandernsatchWasm } from "./bandersnatch-wasm/index.js";
import { SafroleSeal } from "./safrole-seal.js";

const bandersnatch = BandernsatchWasm.new({ synchronous: true });

if (Compatibility.isLessThan(GpVersion.V0_7_0)) {
  describe("Safrole Seal verification", () => {
    it("should verify a valid fallback mode seal and entropySource", async () => {
      // based on jamduna/data/fallback/blocks/1_000.json
      const header = Header.create({
        parentHeaderHash: Bytes.parseBytes(
          "0x03c6255f4eed3db451c775e33e2d7ef03a1ba7fb79cd525b5ddf650703ccdb92",
          HASH_SIZE,
        ).asOpaque(),
        priorStateRoot: Bytes.parseBytes(
          "0xc07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a",
          HASH_SIZE,
        ).asOpaque(),
        extrinsicHash: Bytes.parseBytes(
          "0x189d15af832dfe4f67744008b62c334b569fcbb4c261e0f065655697306ca252",
          HASH_SIZE,
        ).asOpaque(),
        timeSlotIndex: tryAsTimeSlot(12),
        epochMarker: EpochMarker.create({
          entropy: Bytes.parseBytes(
            "0x6f6ad2224d7d58aec6573c623ab110700eaca20a48dc2965d535e466d524af2a",
            HASH_SIZE,
          ).asOpaque(),
          ticketsEntropy: Bytes.parseBytes(
            "0x835ac82bfa2ce8390bb50680d4b7a73dfa2a4cff6d8c30694b24a605f9574eaf",
            HASH_SIZE,
          ).asOpaque(),
          validators: TEST_VALIDATOR_KEYS,
        }),
        ticketsMarker: null,
        offendersMarker: [],
        bandersnatchBlockAuthorIndex: tryAsValidatorIndex(4),
        entropySource: Bytes.parseBytes(
          "0x4b213bfc74f65eb109896f1d57e78809d1a94c0c1b2e4543a9ee470eb6cfdfee96228bd01847dbe9e92c5c8c190fab85da4cb5ecd63cd3c758730b17b1247d1be6a5107ff246b08fbf8dcad39ba00b33e9ee4e2b934f62ee7e503e2a1eeaba11",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
        seal: Bytes.parseBytes(
          "0xa060e079fdeefc27d1278b9a3d1922874c87e8d0dc7885d08443a29a460af827cd497cb2e9df412a1c80c7601f225ec96d05da90c23a4effc9219904b46f1f0404807dd2b0db02bc30212e91f32c2446134f45782acb1e093cd1c9f1b904120f",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
      });
      const encoded = Encoder.encodeObject(Header.Codec, header, tinyChainSpec);
      const headerView = Decoder.decodeObject(Header.Codec.View, encoded, tinyChainSpec);

      const safroleSeal = new SafroleSeal(bandersnatch);
      const result = await safroleSeal.verifyHeaderSeal(headerView, {
        currentValidatorData: TEST_VALIDATOR_DATA,
        sealingKeySeries: SafroleSealingKeysData.keys(
          tryAsPerEpochBlock(
            [
              Bytes.parseBytes(
                "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
                BANDERSNATCH_KEY_BYTES,
              ).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
              Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            ],
            tinyChainSpec,
          ),
        ),
        currentEntropy: Bytes.parseBytes(
          "0xd2d34655ebcad804c56d2fd5f932c575b6a5dbb3f5652c5202bcc75ab9c2cc95",
          HASH_SIZE,
        ).asOpaque(),
      });

      assert.deepStrictEqual(result, {
        isError: false,
        isOk: true,
        ok: Bytes.parseBytes(
          "0x543054132a05c2710ac8fd0924810d3a8f7b7a7637c31a35cf6a05d54122529f",
          HASH_SIZE,
        ).asOpaque(),
      });
    });

    it("should verify a valid ticket seal and entropySource", async () => {
      // based on jamduna/data/safrole/blocks/2_000.json
      const header = Header.create({
        parentHeaderHash: Bytes.parseBytes(
          "0xd8427123fd8f6bc0f6dc42cfab14c25328667c87ceb9221a55bd85b3bc2d3e3e",
          HASH_SIZE,
        ).asOpaque(),
        priorStateRoot: Bytes.parseBytes(
          "0x3f9434363d9661bb5990fb94356edcce546649a1a4b3015c1b93de9980d88bc0",
          HASH_SIZE,
        ).asOpaque(),
        extrinsicHash: Bytes.parseBytes(
          "0x85518b5771f4601dce81fdca1920ae2b8d11153f05cc7120ade02ae678ef1296",
          HASH_SIZE,
        ).asOpaque(),
        timeSlotIndex: tryAsTimeSlot(24),
        epochMarker: EpochMarker.create({
          entropy: Bytes.parseBytes(
            "0x767ac90c16dcbf976628e835c103b2d7906080546c7176062b110955b19923ae",
            HASH_SIZE,
          ).asOpaque(),
          ticketsEntropy: Bytes.parseBytes(
            "0x6f6ad2224d7d58aec6573c623ab110700eaca20a48dc2965d535e466d524af2a",
            HASH_SIZE,
          ).asOpaque(),
          validators: TEST_VALIDATOR_KEYS,
        }),
        ticketsMarker: null,
        offendersMarker: [],
        bandersnatchBlockAuthorIndex: tryAsValidatorIndex(2),
        entropySource: Bytes.parseBytes(
          "0xcf74e8792ab2b10faecd1df7a0a66b93230408c16ba5cb2ec199eeb75e26cbd1ab9bfeedce7d6312dedae8fcabbcb8c5a7fa2f48f0919fdc85a5ebba4d12680785e29524e32ed25baf7fe74af82a0509f1e81247bcfa1d299d48ea775fa7af15",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
        seal: Bytes.parseBytes(
          "0x98853cdfca6cda5238fc065a678421737782fffbc986819b67dfe96786febdbad5b3adf65fd37ac0a977a287a38c4394ff0a3dcd7523eead74d3885ad26e9e168a52bcb47ac41a53b97c009fcd14d7b9a0ca8f8654496cb9516d704d6d447115",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
      });
      const encoded = Encoder.encodeObject(Header.Codec, header, tinyChainSpec);
      const headerView = Decoder.decodeObject(Header.Codec.View, encoded, tinyChainSpec);

      const safroleSeal = new SafroleSeal(bandersnatch);
      const result = await safroleSeal.verifyHeaderSeal(headerView, {
        currentValidatorData: TEST_VALIDATOR_DATA,
        sealingKeySeries: SafroleSealingKeysData.tickets(
          tryAsPerEpochBlock(
            [
              Ticket.create({
                id: Bytes.parseBytes("0x0b7537993b0a700def26bb16e99ed0bfb530f616e4c13cf63ecb60bcbe83387d", HASH_SIZE),
                attempt: tryAsTicketAttempt(2),
              }),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
              emptyTicket(),
            ],
            tinyChainSpec,
          ),
        ),
        currentEntropy: Bytes.parseBytes(
          "0x835ac82bfa2ce8390bb50680d4b7a73dfa2a4cff6d8c30694b24a605f9574eaf",
          HASH_SIZE,
        ).asOpaque(),
      });

      assert.deepStrictEqual(result, {
        isError: false,
        isOk: true,
        ok: Bytes.parseBytes(
          "0xc4b7950fa7836d7b8da1ac65e1664d7d07acffe6f0f1a51776fe5811e568265b",
          HASH_SIZE,
        ).asOpaque(),
      });
    });
  });

  const emptyTicket = (): Ticket => Ticket.create({ id: Bytes.zero(HASH_SIZE), attempt: tryAsTicketAttempt(0) });

  const TEST_VALIDATOR_KEYS = tryAsPerValidator<ValidatorKeys>(
    [
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
    ].map((x) =>
      ValidatorKeys.create({
        bandersnatch: Bytes.parseBytes(x.bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
        ed25519: Bytes.parseBytes(x.ed25519, ED25519_KEY_BYTES).asOpaque(),
      }),
    ),
    tinyChainSpec,
  );

  const TEST_VALIDATOR_DATA = asKnownSize(
    TEST_VALIDATOR_KEYS.map((x) =>
      ValidatorData.create({
        bandersnatch: x.bandersnatch,
        ed25519: x.ed25519,
        bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
        metadata: Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
      }),
    ),
  );
}
