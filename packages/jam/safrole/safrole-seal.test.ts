import assert from "node:assert";
import { describe, it } from "node:test";
import {
  Header,
  ValidatorKeys,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
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

if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)) {
  describe("Safrole Seal verification", () => {
    it("should verify a valid fallback mode seal and entropySource", async () => {
      // based on test-vectors/w3f-davxy_070/traces/fallback/00000002.json
      const header = Header.create({
        parentHeaderHash: Bytes.parseBytes(
          "0x74ad675f8d6480a17b6ec0178962ea0166053c384689044c6f4cd38c97c2776d",
          HASH_SIZE,
        ).asOpaque(),
        priorStateRoot: Bytes.parseBytes(
          "0x4542b8bd55b25f52767e37c1c72004fefdd068878084e9c87c3ab0dc38543173",
          HASH_SIZE,
        ).asOpaque(),
        extrinsicHash: Bytes.parseBytes(
          "0x189d15af832dfe4f67744008b62c334b569fcbb4c261e0f065655697306ca252",
          HASH_SIZE,
        ).asOpaque(),
        timeSlotIndex: tryAsTimeSlot(2),
        epochMarker: null,
        ticketsMarker: null,
        offendersMarker: [],
        bandersnatchBlockAuthorIndex: tryAsValidatorIndex(3),
        entropySource: Bytes.parseBytes(
          "0x21237c35f11cd849a27ffa62e4aeb1c9a06bca2e42b89e16f93932d773b4ed5e7df1d7c48986eeb1313462aec31668dbfa6d3e499b457c678320ce0bb0fb611be3b6b240e1cd757e624d50cb1a163ca5c6348f97b782f5db74f8877eae593a0d",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
        seal: Bytes.parseBytes(
          "0x732cef37ec4d9f100aca7445a486afc3fa1015056e3377905168e7b88d40286e68d943e77c0e5f5539c40416cd494b50aeb227ba55701d64e5586c790aebc60c1eba819c07c1b6f8fbca0d7765caaa61e494271c925df7ee42e6a19b0d3d2313",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
      });
      const encoded = Encoder.encodeObject(Header.Codec, header, tinyChainSpec);
      const headerView = Decoder.decodeObject(Header.Codec.View, encoded, tinyChainSpec);

      const safroleSeal = new SafroleSeal(bandersnatch);
      const result = await safroleSeal.verifyHeaderSeal(headerView, {
        currentValidatorData: TEST_VALIDATOR_DATA,
        sealingKeySeries: SEALING_KEYS,
        currentEntropy: Bytes.parseBytes(
          "0x405c80c1f6a2d5a0f8dbc56996f04230221100d9500244648f02a795d7850eac",
          HASH_SIZE,
        ).asOpaque(),
      });

      assert.deepStrictEqual(result, {
        isError: false,
        isOk: true,
        ok: Bytes.parseBytes(
          "0xc13af3d0cbdb7174590f34518e3beb05708935ceaee242e7ba11a94ca87bd007",
          HASH_SIZE,
        ).asOpaque(),
      });
    });

    it("should verify a valid ticket seal and entropySource", async () => {
      // based on test-vectors/w3f-davxy_070/traces/safrole/00000002.json
      const header = Header.create({
        parentHeaderHash: Bytes.parseBytes(
          "0x74ad675f8d6480a17b6ec0178962ea0166053c384689044c6f4cd38c97c2776d",
          HASH_SIZE,
        ).asOpaque(),
        priorStateRoot: Bytes.parseBytes(
          "0x4542b8bd55b25f52767e37c1c72004fefdd068878084e9c87c3ab0dc38543173",
          HASH_SIZE,
        ).asOpaque(),
        extrinsicHash: Bytes.parseBytes(
          "0x189d15af832dfe4f67744008b62c334b569fcbb4c261e0f065655697306ca252",
          HASH_SIZE,
        ).asOpaque(),
        timeSlotIndex: tryAsTimeSlot(2),
        epochMarker: null,
        ticketsMarker: null,
        offendersMarker: [],
        bandersnatchBlockAuthorIndex: tryAsValidatorIndex(3),
        entropySource: Bytes.parseBytes(
          "0x21237c35f11cd849a27ffa62e4aeb1c9a06bca2e42b89e16f93932d773b4ed5e7df1d7c48986eeb1313462aec31668dbfa6d3e499b457c678320ce0bb0fb611be3b6b240e1cd757e624d50cb1a163ca5c6348f97b782f5db74f8877eae593a0d",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
        seal: Bytes.parseBytes(
          "0x732cef37ec4d9f100aca7445a486afc3fa1015056e3377905168e7b88d40286e68d943e77c0e5f5539c40416cd494b50aeb227ba55701d64e5586c790aebc60c1eba819c07c1b6f8fbca0d7765caaa61e494271c925df7ee42e6a19b0d3d2313",
          BANDERSNATCH_VRF_SIGNATURE_BYTES,
        ).asOpaque(),
      });
      const encoded = Encoder.encodeObject(Header.Codec, header, tinyChainSpec);
      const headerView = Decoder.decodeObject(Header.Codec.View, encoded, tinyChainSpec);

      const safroleSeal = new SafroleSeal(bandersnatch);
      const result = await safroleSeal.verifyHeaderSeal(headerView, {
        currentValidatorData: TEST_VALIDATOR_DATA,
        sealingKeySeries: SEALING_KEYS,
        currentEntropy: Bytes.parseBytes(
          "0x405c80c1f6a2d5a0f8dbc56996f04230221100d9500244648f02a795d7850eac",
          HASH_SIZE,
        ).asOpaque(),
      });

      assert.deepStrictEqual(result, {
        isError: false,
        isOk: true,
        ok: Bytes.parseBytes(
          "0xc13af3d0cbdb7174590f34518e3beb05708935ceaee242e7ba11a94ca87bd007",
          HASH_SIZE,
        ).asOpaque(),
      });
    });
  });

  const TEST_VALIDATOR_KEYS = tryAsPerValidator<ValidatorKeys>(
    [
      {
        bandersnatch: "0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3",
        ed25519: "0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace",
      },
      {
        bandersnatch: "0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91",
        ed25519: "0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933",
      },
      {
        bandersnatch: "0x9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66",
        ed25519: "0xcab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341",
      },
      {
        bandersnatch: "0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc",
        ed25519: "0xf30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d",
      },
      {
        bandersnatch: "0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b",
        ed25519: "0x8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a",
      },
      {
        bandersnatch: "0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e",
        ed25519: "0xab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06",
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

  const SEALING_KEYS = SafroleSealingKeysData.keys(
    tryAsPerEpochBlock(
      [
        Bytes.parseBytes(
          "0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
        Bytes.parseBytes(
          "0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc",
          BANDERSNATCH_KEY_BYTES,
        ).asOpaque(),
      ],
      tinyChainSpec,
    ),
  );
}
