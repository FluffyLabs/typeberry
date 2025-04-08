import assert from "node:assert";
import { describe, it } from "node:test";
import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  BLS_KEY_BYTES,
  ED25519_KEY_BYTES,
  EpochMarker,
  Header,
  tryAsPerEpochBlock,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { Ticket, tryAsTicketAttempt } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data";
import { BandernsatchWasm } from "./bandersnatch-wasm";
import { SafroleSeal } from "./safrole-seal";

const bandersnatch = BandernsatchWasm.new({ synchronous: true });

describe("Safrole Seal verification", () => {
  it("should verify a valid fallback mode seal and entropySource", async () => {
    const header = Header.fromCodec({
      parentHeaderHash: Bytes.parseBytes(
        "0x476243ad7cc4fc49cb6cb362c6568e931731d8650d917007a6037cceedd62244",
        HASH_SIZE,
      ).asOpaque(),
      priorStateRoot: Bytes.parseBytes(
        "0x99f227c2137bc71b415c18e4eb74c6450e575af3708d52cb40ea15dee1ce574a",
        HASH_SIZE,
      ).asOpaque(),
      extrinsicHash: Bytes.parseBytes(
        "0x189d15af832dfe4f67744008b62c334b569fcbb4c261e0f065655697306ca252",
        HASH_SIZE,
      ).asOpaque(),
      timeSlotIndex: tryAsTimeSlot(12),
      epochMarker: EpochMarker.fromCodec({
        entropy: Bytes.parseBytes(
          "0x6f6ad2224d7d58aec6573c623ab110700eaca20a48dc2965d535e466d524af2a",
          HASH_SIZE,
        ).asOpaque(),
        ticketsEntropy: Bytes.parseBytes(
          "0x835ac82bfa2ce8390bb50680d4b7a73dfa2a4cff6d8c30694b24a605f9574eaf",
          HASH_SIZE,
        ).asOpaque(),
        validators: asKnownSize(
          [
            "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
            "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
            "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
            "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
            "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
            "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
          ].map((x) => Bytes.parseBytes(x, BANDERSNATCH_KEY_BYTES).asOpaque()),
        ),
      }),
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: tryAsValidatorIndex(4),
      entropySource: Bytes.parseBytes(
        "0x4b213bfc74f65eb109896f1d57e78809d1a94c0c1b2e4543a9ee470eb6cfdfee96228bd01847dbe9e92c5c8c190fab85da4cb5ecd63cd3c758730b17b1247d1be6a5107ff246b08fbf8dcad39ba00b33e9ee4e2b934f62ee7e503e2a1eeaba11",
        BANDERSNATCH_VRF_SIGNATURE_BYTES,
      ).asOpaque(),
      seal: Bytes.parseBytes(
        "0xa060e079fdeefc27d1278b9a3d1922874c87e8d0dc7885d08443a29a460af82701bf291885c3c1d84f439688abb435ab1c5cf29baaa1cff157d2731ee748a005032620b6bdc3282b7dd8c54d0e71ad8577cdda0736841cff87394c4ab52d610e",
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
      ok: Bytes.parseBytes("0x543054132a05c2710ac8fd0924810d3a8f7b7a7637c31a35cf6a05d54122529f", HASH_SIZE).asOpaque(),
    });
  });

  it("should verify a valid ticket seal and entropySource", async () => {
    const header = Header.fromCodec({
      parentHeaderHash: Bytes.parseBytes(
        "0xe51ca8464c60f7bfe27ffb70ec280e9b09a41fca2f7240128ae6b4ae12a661a7",
        HASH_SIZE,
      ).asOpaque(),
      priorStateRoot: Bytes.parseBytes(
        "0x239dc138127703eaa840b43eefd5e5f689d1a405855d7aec0ef7239b7000d6d6",
        HASH_SIZE,
      ).asOpaque(),
      extrinsicHash: Bytes.parseBytes(
        "0xd59e4e1e6ab2f98219c0d8b2bf2fcc077e45cb11af4556f17976d18e43581091",
        HASH_SIZE,
      ).asOpaque(),
      timeSlotIndex: tryAsTimeSlot(24),
      epochMarker: EpochMarker.fromCodec({
        entropy: Bytes.parseBytes(
          "0x767ac90c16dcbf976628e835c103b2d7906080546c7176062b110955b19923ae",
          HASH_SIZE,
        ).asOpaque(),
        ticketsEntropy: Bytes.parseBytes(
          "0x6f6ad2224d7d58aec6573c623ab110700eaca20a48dc2965d535e466d524af2a",
          HASH_SIZE,
        ).asOpaque(),
        validators: asKnownSize(
          [
            "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
            "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
            "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
            "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
            "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
            "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
          ].map((x) => Bytes.parseBytes(x, BANDERSNATCH_KEY_BYTES).asOpaque()),
        ),
      }),
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: tryAsValidatorIndex(2),
      entropySource: Bytes.parseBytes(
        "0xcf74e8792ab2b10faecd1df7a0a66b93230408c16ba5cb2ec199eeb75e26cbd1ab9bfeedce7d6312dedae8fcabbcb8c5a7fa2f48f0919fdc85a5ebba4d12680785e29524e32ed25baf7fe74af82a0509f1e81247bcfa1d299d48ea775fa7af15",
        BANDERSNATCH_VRF_SIGNATURE_BYTES,
      ).asOpaque(),
      seal: Bytes.parseBytes(
        "0x98853cdfca6cda5238fc065a678421737782fffbc986819b67dfe96786febdbaa992d625c1131c408bbf0e89c9740d8d762698894719fae7729ffdc7c814cc066892b77200a7ac5aaf401102b31a4a0c35177401ef499107ea4c3d65b006540c",
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
            new Ticket(
              Bytes.parseBytes("0x0b7537993b0a700def26bb16e99ed0bfb530f616e4c13cf63ecb60bcbe83387d", HASH_SIZE),
              tryAsTicketAttempt(2),
            ),
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
      ok: Bytes.parseBytes("0xc4b7950fa7836d7b8da1ac65e1664d7d07acffe6f0f1a51776fe5811e568265b", HASH_SIZE).asOpaque(),
    });
  });
});

const emptyTicket = (): Ticket => new Ticket(Bytes.zero(HASH_SIZE), tryAsTicketAttempt(0));
const TEST_VALIDATOR_DATA = asKnownSize(
  [
    "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
    "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
    "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
    "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
    "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
    "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
  ].map(
    (x) =>
      new ValidatorData(
        Bytes.parseBytes(x, BANDERSNATCH_KEY_BYTES).asOpaque(),
        Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
        Bytes.zero(BLS_KEY_BYTES).asOpaque(),
        Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
      ),
  ),
);
