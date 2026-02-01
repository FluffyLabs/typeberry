import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  Block,
  DisputesExtrinsic,
  type EntropyHash,
  EpochMarker,
  Extrinsic,
  Header,
  type TicketsMarker,
  type TimeSlot,
  tryAsTimeSlot,
  tryAsValidatorIndex,
  type ValidatorIndex,
  ValidatorKeys,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asKnownSize, FixedSizeArray } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  BLS_KEY_BYTES,
  ED25519_KEY_BYTES,
  initWasm,
} from "@typeberry/crypto";
import { BANDERSNATCH_RING_ROOT_BYTES } from "@typeberry/crypto/bandersnatch.js";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { Blake2b, HASH_SIZE, keccak } from "@typeberry/hash";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_FALLBACK_SEAL } from "@typeberry/safrole/constants.js";
import { VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";
import { SafroleSealingKeysKind } from "@typeberry/state/safrole-data.js";
import { asOpaqueType, deepEqual, Result } from "@typeberry/utils";
import { type BlockSealInput, Generator } from "./generator.js";

// Test validator data - need 6 validators to match tinyChainSpec.validatorsCount
const validatorDataArray = [
  {
    bandersnatch: "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
    ed25519: "0x837ce344bc9defceb0d7de7e9e9925096768b7adb4dad932e532eb6551e0ea02",
    bls: Bytes.zero(BLS_KEY_BYTES),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  },
  {
    bandersnatch: "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
    ed25519: "0xb3e0e096b02e2ec98a3441410aeddd78c95e27a0da6f411a09c631c0f2bea6e9",
    bls: Bytes.zero(BLS_KEY_BYTES),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  },
  {
    bandersnatch: "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
    ed25519: "0x5c7f34a4bd4f2d04076a8c6f9060a0c8d2c6bdd082ceb3eda7df381cb260faff",
    bls: Bytes.zero(BLS_KEY_BYTES),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  },
  {
    bandersnatch: "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
    ed25519: "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
    bls: Bytes.zero(BLS_KEY_BYTES),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  },
  {
    bandersnatch: "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
    ed25519: "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
    bls: Bytes.zero(BLS_KEY_BYTES),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  },
  {
    bandersnatch: "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
    ed25519: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
    bls: Bytes.zero(BLS_KEY_BYTES),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  },
].map(({ bandersnatch, bls, ed25519, metadata }) =>
  ValidatorData.create({
    bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
    bls: bls.asOpaque(),
    ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
    metadata: metadata.asOpaque(),
  }),
);

const validators = asKnownSize(validatorDataArray);

// Expected mock values - these are returned by mocked VRF functions
const MOCK_SEAL_SIGNATURE = Bytes.fill(BANDERSNATCH_VRF_SIGNATURE_BYTES, 2);
const MOCK_STATE_ROOT = Bytes.fill(HASH_SIZE, 3);
const MOCK_PARENT_HASH = Bytes.fill(HASH_SIZE, 0xab);

// Common test inputs
const MOCK_BANDERSNATCH_SECRET = Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque();
const MOCK_SEAL_PAYLOAD = asOpaqueType(
  BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, Bytes.zero(HASH_SIZE).raw),
) as BlockSealInput;

// Mock state entropy values
const MOCK_ENTROPY_0: EntropyHash = Bytes.fill(HASH_SIZE, 10).asOpaque();
const MOCK_ENTROPY_1: EntropyHash = Bytes.fill(HASH_SIZE, 20).asOpaque();
const MOCK_ENTROPY_2: EntropyHash = Bytes.fill(HASH_SIZE, 30).asOpaque();
const MOCK_ENTROPY_3: EntropyHash = Bytes.fill(HASH_SIZE, 40).asOpaque();

// Mock BlocksDb
function createMockBlocksDb(headerHash: Bytes<32>) {
  return {
    getBestHeaderHash: () => headerHash.asOpaque(),
  } as unknown as BlocksDb;
}

// Mock StatesDb
function createMockStatesDb(state: ReturnType<typeof createMockState>) {
  return {
    getState: () => state,
    getStateRoot: () => Promise.resolve(MOCK_STATE_ROOT.asOpaque()),
  } as unknown as StatesDb;
}

function createMockState(timeslot: number) {
  const bandersnatchKeys = validatorDataArray.map((v) => v.bandersnatch);

  return {
    timeslot: tryAsTimeSlot(timeslot),
    entropy: FixedSizeArray.new([MOCK_ENTROPY_0, MOCK_ENTROPY_1, MOCK_ENTROPY_2, MOCK_ENTROPY_3], 4),
    previousValidatorData: validators,
    currentValidatorData: validators,
    designatedValidatorData: validators,
    nextValidatorData: validators,
    ticketsAccumulator: asKnownSize([]),
    sealingKeySeries: {
      kind: SafroleSealingKeysKind.Keys as const,
      keys: asKnownSize(bandersnatchKeys),
    },
    epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    disputesRecords: {
      punishSet: { size: 0, has: () => false },
    },
  };
}

/**
 * Creates an expected block based on mock values and provided parameters.
 * Used for asserting generated blocks match expected structure.
 */
function createExpectedBlock(params: {
  timeSlot: TimeSlot;
  validatorIndex: ValidatorIndex;
  extrinsicHash: Bytes<32>;
  epochMarker?: EpochMarker | null;
  ticketsMarker?: TicketsMarker | null;
}) {
  return Block.create({
    header: Header.create({
      parentHeaderHash: MOCK_PARENT_HASH.asOpaque(),
      priorStateRoot: MOCK_STATE_ROOT.asOpaque(),
      extrinsicHash: params.extrinsicHash.asOpaque(),
      timeSlotIndex: params.timeSlot,
      bandersnatchBlockAuthorIndex: params.validatorIndex,
      entropySource: MOCK_SEAL_SIGNATURE.asOpaque(),
      seal: MOCK_SEAL_SIGNATURE.asOpaque(),
      epochMarker: params.epochMarker ?? null,
      ticketsMarker: params.ticketsMarker ?? null,
      offendersMarker: [],
    }),
    extrinsic: Extrinsic.create({
      tickets: asOpaqueType([]),
      preimages: [],
      guarantees: asOpaqueType([]),
      assurances: asOpaqueType([]),
      disputes: DisputesExtrinsic.create({
        verdicts: [],
        culprits: [],
        faults: [],
      }),
    }),
  });
}

describe("Generator", () => {
  let blake2b: Blake2b;
  let keccakHasher: keccak.KeccakHasher;
  let bandersnatch: BandernsatchWasm;

  beforeEach(async () => {
    await initWasm();
    blake2b = await Blake2b.createHasher();
    keccakHasher = await keccak.KeccakHasher.create();
    bandersnatch = await BandernsatchWasm.new();

    // Mock VRF functions to return predictable results
    mock.method(bandersnatchVrf, "getVrfOutputHash", () =>
      Promise.resolve(Result.ok(Bytes.zero(HASH_SIZE).asOpaque())),
    );
    mock.method(bandersnatchVrf, "generateSeal", () => Promise.resolve(Result.ok(MOCK_SEAL_SIGNATURE.asOpaque())));
    mock.method(bandersnatchVrf, "getRingCommitment", () =>
      Promise.resolve(Result.ok(Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque())),
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("nextBlock - fallback mode", () => {
    it("should create block for same-epoch slot", async () => {
      const state = createMockState(0);
      const blocksDb = createMockBlocksDb(MOCK_PARENT_HASH);
      const statesDb = createMockStatesDb(state);

      const generator = new Generator(tinyChainSpec, bandersnatch, keccakHasher, blake2b, blocksDb, statesDb);

      const validatorIndex = tryAsValidatorIndex(0);
      const timeSlot = tryAsTimeSlot(1);

      const block = await generator.nextBlock(validatorIndex, MOCK_BANDERSNATCH_SECRET, MOCK_SEAL_PAYLOAD, timeSlot);

      const expectedBlock = createExpectedBlock({
        timeSlot,
        validatorIndex,
        extrinsicHash: block.header.extrinsicHash,
      });

      deepEqual(block, expectedBlock);
    });

    it("should create block with epoch marker at epoch boundary", async () => {
      // tinyChainSpec.epochLength = 12, so:
      // - timeslot 11 is last slot of epoch 0
      // - timeslot 12 is first slot of epoch 1
      const lastSlotOfEpoch0 = tinyChainSpec.epochLength - 1;
      const firstSlotOfEpoch1 = tinyChainSpec.epochLength;

      const state = createMockState(lastSlotOfEpoch0);
      const blocksDb = createMockBlocksDb(MOCK_PARENT_HASH);
      const statesDb = createMockStatesDb(state);

      const generator = new Generator(tinyChainSpec, bandersnatch, keccakHasher, blake2b, blocksDb, statesDb);

      const validatorIndex = tryAsValidatorIndex(0);
      const timeSlot = tryAsTimeSlot(firstSlotOfEpoch1);

      const block = await generator.nextBlock(validatorIndex, MOCK_BANDERSNATCH_SECRET, MOCK_SEAL_PAYLOAD, timeSlot);

      const expectedEpochMarker = EpochMarker.create({
        entropy: MOCK_ENTROPY_0,
        ticketsEntropy: MOCK_ENTROPY_1,
        validators: asKnownSize(
          validatorDataArray.map((v) =>
            ValidatorKeys.create({
              bandersnatch: v.bandersnatch,
              ed25519: v.ed25519,
            }),
          ),
        ),
      });

      const expectedBlock = createExpectedBlock({
        timeSlot,
        validatorIndex,
        extrinsicHash: block.header.extrinsicHash,
        epochMarker: expectedEpochMarker,
      });

      deepEqual(block, expectedBlock);
    });
  });
});
