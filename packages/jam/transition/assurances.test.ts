import assert from "node:assert";
import { describe, it } from "node:test";
import {
  type HeaderHash,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import {
  type AssurancesExtrinsicView,
  AvailabilityAssurance,
  assurancesExtrinsicCodec,
} from "@typeberry/block/assurances.js";
import { testWorkReportHex } from "@typeberry/block/test-helpers.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { BitVec, Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES } from "@typeberry/crypto";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import { AvailabilityAssignment, VALIDATOR_META_BYTES, ValidatorData, tryAsPerCore } from "@typeberry/state";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { Assurances, AssurancesError, type AssurancesInput } from "./assurances.js";
import { copyAndUpdateState } from "./test.utils.js";

function assurancesAsView(spec: ChainSpec, assurances: AvailabilityAssurance[]): AssurancesExtrinsicView {
  const encoded = Encoder.encodeObject(assurancesExtrinsicCodec, asOpaqueType(assurances), spec);
  return Decoder.decodeObject(assurancesExtrinsicCodec.View, encoded, spec);
}

const DEFAULT_HEADER_HASH: HeaderHash = Bytes.parseBytes(
  "0xd61a38a0f73beda90e8c1dfba731f65003742539f4260694f44e22cabef24a8e",
  HASH_SIZE,
).asOpaque();

describe("Assurances", () => {
  it("should perform a transition with empty state", async () => {
    const assurances = new Assurances(tinyChainSpec, {
      availabilityAssignment: tryAsPerCore([null, null], tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });

    const input: AssurancesInput = {
      parentHash: DEFAULT_HEADER_HASH,
      slot: tryAsTimeSlot(12),
      assurances: assurancesAsView(tinyChainSpec, []),
    };

    const res = await assurances.transition(input);

    assert.strictEqual(res.isOk, true);
    deepEqual(res.ok.availableReports, []);
    const state = copyAndUpdateState(assurances.state, res.ok.stateUpdate);
    deepEqual(state, {
      availabilityAssignment: tryAsPerCore([null, null], tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });
  });

  it("should perform some transition", async () => {
    const assurances = new Assurances(tinyChainSpec, {
      availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT.slice(), tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });

    const input: AssurancesInput = {
      parentHash: DEFAULT_HEADER_HASH,
      slot: tryAsTimeSlot(12),
      assurances: assurancesAsView(
        tinyChainSpec,
        [
          {
            bitfield: "0x02",
            validatorIndex: 0,
            signature:
              "0x8ca67779a98b2cb44a45082ec9fd9222462b8310115e23df0b4df9959efe90055009dc9c11da1ae59abd076aeb455b4e82883fd0cf35f69ba2cb0f3a8ee3800e",
          },
          {
            bitfield: "0x01",
            validatorIndex: 1,
            signature:
              "0x08a112654c32d117fb4ceb0e6a7edf92e4de6cb27532d3ceda8bb2fcf8337aeec85a734f7c36531b61e34570a3e090ffe8ab1839f412eaebde451aabf786a500",
          },
          {
            bitfield: "0x03",
            validatorIndex: 2,
            signature:
              "0xdbd50734b049bcc9e25f5c4d2d2b635e22ec1d4eefcc324863de9e1673bacb4b7ac4424a946abae83755908a3f77470776c160e7d5b42991c1b8914bfc16b700",
          },
          {
            bitfield: "0x03",
            validatorIndex: 3,
            signature:
              "0x2e1c0fe5ada7046355c7a8b23320dea86edf0df6410d13126f738755dec8f45652fd8c7ac2c84e682d745d2273977d03916865236fa93c9484bc41ed4318d30a",
          },
          {
            bitfield: "0x03",
            validatorIndex: 4,
            signature:
              "0xa3afee85825aefb49cfe10000b72d22321f6d562f89f57f56da813f62761130774e2540b2c0ce33da3c28fcbffe52ea0d1eccfbd859be46835128c4cc87fb50c",
          },
          {
            bitfield: "0x01",
            validatorIndex: 5,
            signature:
              "0x507b0321d73c495135f311c42022eb1a46c89bfab80bd21e8ca0a38823a84e57e848154bf9c9f2065a63b678bf2d7bc78f449e1bebd2beb69c68fbb14c04eb08",
          },
        ].map(intoAssurances),
      ),
    };

    const res = await assurances.transition(input);

    assert.strictEqual(res.isOk, true);
    deepEqual(res.ok.availableReports, [INITIAL_ASSIGNMENT[0].workReport.data], { context: "result" });
    const state = copyAndUpdateState(assurances.state, res.ok.stateUpdate);
    deepEqual(
      state,
      {
        availabilityAssignment: tryAsPerCore([null, INITIAL_ASSIGNMENT[1]], tinyChainSpec),
        currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
      },
      { context: "state" },
    );
  });

  it("should reject invalid signatures", async () => {
    const assurances = new Assurances(tinyChainSpec, {
      availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT.slice(), tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });

    const input: AssurancesInput = {
      parentHash: DEFAULT_HEADER_HASH,
      slot: tryAsTimeSlot(12),
      assurances: assurancesAsView(
        tinyChainSpec,
        [
          {
            bitfield: "0x02",
            validatorIndex: 0,
            signature:
              "0xdeadbeefa98b2cb44a45082ec9fd9222462b8310115e23df0b4df9959efe90055009dc9c11da1ae59abd076aeb455b4e82883fd0cf35f69ba2cb0f3a8ee3800e",
          },
        ].map(intoAssurances),
      ),
    };

    const res = await assurances.transition(input);

    deepEqual(
      res,
      {
        isOk: false,
        isError: true,
        error: AssurancesError.InvalidSignature,
        details: "invalid signatures at 0",
      },
      { context: "result" },
    );
    deepEqual(
      assurances.state,
      {
        availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT, tinyChainSpec),
        currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
      },
      { context: "state" },
    );
  });

  it("should reject invalid validator index", async () => {
    const assurances = new Assurances(tinyChainSpec, {
      availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT.slice(), tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });

    const input: AssurancesInput = {
      parentHash: DEFAULT_HEADER_HASH,
      slot: tryAsTimeSlot(12),
      assurances: assurancesAsView(
        tinyChainSpec,
        [
          {
            bitfield: "0x02",
            validatorIndex: 1023,
            signature:
              "0xdeadbeefa98b2cb44a45082ec9fd9222462b8310115e23df0b4df9959efe90055009dc9c11da1ae59abd076aeb455b4e82883fd0cf35f69ba2cb0f3a8ee3800e",
          },
        ].map(intoAssurances),
      ),
    };

    const res = await assurances.transition(input);

    deepEqual(
      res,
      {
        isOk: false,
        isError: true,
        error: AssurancesError.InvalidValidatorIndex,
        details: "",
      },
      { context: "result" },
    );
    deepEqual(
      assurances.state,
      {
        availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT, tinyChainSpec),
        currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
      },
      { context: "state" },
    );
  });

  it("should reject invalid order", async () => {
    const assurances = new Assurances(tinyChainSpec, {
      availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT.slice(), tinyChainSpec),
      currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
    });

    const input: AssurancesInput = {
      parentHash: DEFAULT_HEADER_HASH,
      slot: tryAsTimeSlot(12),
      assurances: assurancesAsView(
        tinyChainSpec,
        [
          {
            bitfield: "0x01",
            validatorIndex: 1,
            signature:
              "0x08a112654c32d117fb4ceb0e6a7edf92e4de6cb27532d3ceda8bb2fcf8337aeec85a734f7c36531b61e34570a3e090ffe8ab1839f412eaebde451aabf786a500",
          },
          {
            bitfield: "0x02",
            validatorIndex: 0,
            signature:
              "0x8ca67779a98b2cb44a45082ec9fd9222462b8310115e23df0b4df9959efe90055009dc9c11da1ae59abd076aeb455b4e82883fd0cf35f69ba2cb0f3a8ee3800e",
          },
        ].map(intoAssurances),
      ),
    };

    const res = await assurances.transition(input);

    deepEqual(
      res,
      {
        isOk: false,
        isError: true,
        error: AssurancesError.InvalidOrder,
        details: "order: expected: 2, got: 0",
      },
      { context: "result" },
    );
    deepEqual(
      assurances.state,
      {
        availabilityAssignment: tryAsPerCore(INITIAL_ASSIGNMENT, tinyChainSpec),
        currentValidatorData: tryAsPerValidator(VALIDATORS, tinyChainSpec),
      },
      { context: "state" },
    );
  });
});

function intoAssurances(data: { bitfield: string; validatorIndex: number; signature: string }): AvailabilityAssurance {
  const anchor = DEFAULT_HEADER_HASH;
  const bitfield = BitVec.fromBytes(Bytes.parseBytes(data.bitfield, 1), tinyChainSpec.coresCount);
  const validatorIndex = tryAsValidatorIndex(data.validatorIndex);
  const signature = Bytes.parseBytes(data.signature, ED25519_SIGNATURE_BYTES).asOpaque();

  return AvailabilityAssurance.create({ anchor, bitfield, validatorIndex, signature });
}

function intoValidatorData({ bandersnatch, ed25519 }: { bandersnatch: string; ed25519: string }): ValidatorData {
  return ValidatorData.create({
    ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
    bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
    bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  });
}

function newAvailabilityAssignment(core: number, timeout: number): AvailabilityAssignment {
  const source = BytesBlob.parseBlob(testWorkReportHex());
  const report = Decoder.decodeObject(WorkReport.Codec, source, tinyChainSpec);
  const {
    workPackageSpec,
    context,
    authorizerHash,
    authorizationOutput,
    segmentRootLookup,
    results,
    authorizationGasUsed,
  } = report;
  const workReport = WorkReport.create({
    workPackageSpec,
    context,
    coreIndex: tryAsCoreIndex(core),
    authorizerHash,
    authorizationOutput,
    segmentRootLookup,
    results,
    authorizationGasUsed,
  });
  const encoded = Encoder.encodeObject(WorkReport.Codec, workReport, tinyChainSpec);
  const hash = blake2b.hashBytes(encoded).asOpaque();
  const workReportWithHash = new WithHash(hash, workReport);

  return AvailabilityAssignment.create({ workReport: workReportWithHash, timeout: tryAsTimeSlot(timeout) });
}

const INITIAL_ASSIGNMENT: AvailabilityAssignment[] = [
  newAvailabilityAssignment(0, 11),
  newAvailabilityAssignment(1, 11),
];

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
].map(intoValidatorData);
