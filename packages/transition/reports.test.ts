import { describe, it } from "node:test";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  ED25519_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
  type Ed25519Signature,
  type HeaderHash,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import {
  Credential,
  type GuaranteesExtrinsicView,
  ReportGuarantee,
  guaranteesExtrinsicCodec,
} from "@typeberry/block/guarantees";
import testWorkReport from "@typeberry/block/test-work-report";
import { WorkReport } from "@typeberry/block/work-report";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { FixedSizeArray, asKnownSize } from "@typeberry/collections";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE, type KeccakHash, WithHash, blake2b, keccak } from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import {
  AvailabilityAssignment,
  ENTROPY_ENTRIES,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsPerCore,
} from "@typeberry/state";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { Reports, ReportsError, type ReportsInput, type ReportsState } from "./reports";

function guaranteesAsView(spec: ChainSpec, guarantees: ReportGuarantee[]): GuaranteesExtrinsicView {
  const encoded = Encoder.encodeObject(guaranteesExtrinsicCodec, asOpaqueType(guarantees), spec);
  return Decoder.decodeObject(guaranteesExtrinsicCodec.View, encoded, spec);
}

const hasher: Promise<MmrHasher<KeccakHash>> = keccak.KeccakHasher.create().then((hasher) => {
  return {
    hashConcat: (a, b) => keccak.hashBlobs(hasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(hasher, [id, a, b]),
  };
});

async function newReports() {
  const state = newReportsState();
  const headerChain = {
    isInChain(header: HeaderHash) {
      return state.recentBlocks.find((x) => x.headerHash === header) !== undefined;
    },
  };

  return new Reports(tinyChainSpec, state, await hasher, headerChain);
}

describe("Reports - top level", () => {
  it("should perform a transition with empty state", async () => {
    const reports = await newReports();

    const input: ReportsInput = {
      guarantees: guaranteesAsView(tinyChainSpec, []),
      slot: tryAsTimeSlot(12),
    };

    const res = await reports.transition(input);

    deepEqual(res, {
      isOk: true,
      isError: false,
      ok: {
        reported: [],
        reporters: asKnownSize([]),
      },
    });
  });
});

describe("Reports.verifyReportsOrder", () => {
  it("should reject out-of-order guarantees", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 1 }),
        credentials: asOpaqueType([]),
      }),
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([]),
      }),
    ]);

    const res = reports.verifyReportsOrder(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.OutOfOrderGuarantee,
      details: "Core indices of work reports are not unique or in order. Got: 0, expected: 2",
    });
  });

  it("should reject invalid core index", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 3 }),
        credentials: asOpaqueType([]),
      }),
    ]);

    const res = reports.verifyReportsOrder(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadCoreIndex,
      details: "Invalid core index. Got: 3, max: 2",
    });
  });
});

describe("Reports.verifyCredentials", () => {
  it("should reject insufficient credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(1) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.InsufficientGuarantees,
      details: "Invalid number of credentials. Expected 2,3, got 1",
    });
  });

  it("should reject too many credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([1, 2, 3, 4].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(1) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.InsufficientGuarantees,
      details: "Invalid number of credentials. Expected 2,3, got 4",
    });
  });

  it("should reject out-of-order credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 1 }),
        credentials: asOpaqueType([1, 0].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(6) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.NotSortedOrUniqueGuarantors,
      details: "Credentials must be sorted by validator index. Got 0, expected 2",
    });
  });

  it("should reject invalid core assignment", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(6) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.WrongAssignment,
      details: "Invalid core assignment for validator 1. Expected: 1, got: 0",
    });
  });

  it("should reject future reports", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(4) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.FutureReportSlot,
      details: "Report slot is in future or too old. Block 4, Report: 5",
    });
  });

  it("should reject old reports", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(9),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(25) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.ReportEpochBeforeLast,
      details: "Report slot is in future or too old. Block 25, Report: 9",
    });
  });

  it("should return signatures for verification", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(25) };
    const res = reports.verifyCredentials(input);

    const message = BytesBlob.parseBlob(
      "0x6a616d5f67756172616e74656523d9dc0dcb965edddacb4522b56b5f22bf7db53f462f194070254dde92ccfd43",
    );

    deepEqual(res, {
      isOk: true,
      isError: false,
      ok: [
        {
          signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
          key: VALIDATORS[0].ed25519,
          message,
        },
        {
          signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
          key: VALIDATORS[3].ed25519,
          message,
        },
      ],
    });
  });
});

type ReportStateOptions = {
  withCoreAssignment?: boolean;
};

function newCredential(index: number, signature?: Ed25519Signature) {
  return Credential.fromCodec({
    validatorIndex: tryAsValidatorIndex(index),
    signature: signature ?? Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
  });
}

function newReportsState({ withCoreAssignment = false }: ReportStateOptions = {}): ReportsState {
  const spec = tinyChainSpec;
  return {
    availabilityAssignment: tryAsPerCore(withCoreAssignment ? INITIAL_ASSIGNMENT.slice() : [null, null], spec),
    currentValidatorData: tryAsPerValidator(VALIDATORS.slice(), spec),
    previousValidatorData: tryAsPerValidator(VALIDATORS.slice(), spec),
    entropy: getEntropy(1, 2, 3, 4),
    authPools: getAuthPools([1, 2, 3, 4], spec),
    recentBlocks: asOpaqueType([]),
    services: [],
    offenders: asOpaqueType([]),
  };
}

function getAuthPools(source: number[], spec: ChainSpec): ReportsState["authPools"] {
  return tryAsPerCore(
    [
      asOpaqueType(source.map((x) => Bytes.fill(x, HASH_SIZE).asOpaque())),
      asOpaqueType(source.map((x) => Bytes.fill(x, HASH_SIZE).asOpaque())),
    ],
    spec,
  );
}

function getEntropy(e0: number, e1: number, e2: number, e3: number): ReportsState["entropy"] {
  return FixedSizeArray.new(
    [
      Bytes.fill(HASH_SIZE, e0).asOpaque(),
      Bytes.fill(HASH_SIZE, e1).asOpaque(),
      Bytes.fill(HASH_SIZE, e2).asOpaque(),
      Bytes.fill(HASH_SIZE, e3).asOpaque(),
    ],
    ENTROPY_ENTRIES,
  );
}

function intoValidatorData({ bandersnatch, ed25519 }: { bandersnatch: string; ed25519: string }): ValidatorData {
  return ValidatorData.fromCodec({
    ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
    bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
    bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  });
}

function newWorkReport({ core }: { core: number }): WorkReport {
  const source = BytesBlob.parseBlob(testWorkReport);
  const report = Decoder.decodeObject(WorkReport.Codec, source, tinyChainSpec);
  const workReport = new WorkReport(
    report.workPackageSpec,
    report.context,
    tryAsCoreIndex(core),
    report.authorizerHash,
    report.authorizationOutput,
    report.segmentRootLookup,
    report.results,
  );
  return workReport;
}

function newAvailabilityAssignment({ core, timeout }: { core: number; timeout: number }): AvailabilityAssignment {
  const workReport = newWorkReport({ core });
  const encoded = Encoder.encodeObject(WorkReport.Codec, workReport, tinyChainSpec);
  const hash = blake2b.hashBytes(encoded).asOpaque();
  const workReportWithHash = new WithHash(hash, workReport);

  return new AvailabilityAssignment(workReportWithHash, tryAsTimeSlot(timeout));
}

const INITIAL_ASSIGNMENT: AvailabilityAssignment[] = [
  newAvailabilityAssignment({ core: 0, timeout: 11 }),
  newAvailabilityAssignment({ core: 1, timeout: 11 }),
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
