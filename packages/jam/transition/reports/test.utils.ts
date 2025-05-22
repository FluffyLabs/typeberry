import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  type HeaderHash,
  type ServiceId,
  type TimeSlot,
  tryAsCoreIndex,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { codecKnownSizeArray, codecWithContext } from "@typeberry/block/codec";
import {
  Credential,
  GuaranteesExtrinsicBounds,
  type GuaranteesExtrinsicView,
  ReportGuarantee,
  guaranteesExtrinsicCodec,
} from "@typeberry/block/guarantees";
import { RefineContext } from "@typeberry/block/refine-context";
import testWorkReport from "@typeberry/block/test-work-report";
import { type WorkPackageHash, type WorkPackageInfo, WorkReport } from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder, codec } from "@typeberry/codec";
import { FixedSizeArray, HashDictionary, asKnownSize } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/crypto";
import { HASH_SIZE, type KeccakHash, type OpaqueHash, WithHash, blake2b, keccak } from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  AvailabilityAssignment,
  ENTROPY_ENTRIES,
  Service,
  ServiceAccountInfo,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsPerCore,
} from "@typeberry/state";
import type { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";
import { asOpaqueType } from "@typeberry/utils";
import { Reports, type ReportsState } from "./reports";

const hasher: Promise<MmrHasher<KeccakHash>> = keccak.KeccakHasher.create().then((hasher) => {
  return {
    hashConcat: (a, b) => keccak.hashBlobs(hasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(hasher, [id, a, b]),
  };
});

type WorkReportOptions = {
  core: number;
  authorizer?: OpaqueHash;
  anchorBlock?: OpaqueHash;
  stateRoot?: OpaqueHash;
  beefyRoot?: OpaqueHash;
  lookupAnchorSlot?: TimeSlot;
  lookupAnchor?: OpaqueHash;
  prerequisites?: OpaqueHash[];
  resultSize?: number;
};

export function newWorkReport({
  core,
  authorizer,
  anchorBlock,
  stateRoot,
  beefyRoot,
  lookupAnchorSlot,
  lookupAnchor,
  prerequisites,
  resultSize,
}: WorkReportOptions): WorkReport {
  const source = BytesBlob.parseBlob(testWorkReport);
  const report = Decoder.decodeObject(WorkReport.Codec, source, tinyChainSpec);
  const context = RefineContext.create({
    anchor: anchorBlock !== undefined ? anchorBlock.asOpaque() : report.context.anchor,
    stateRoot: stateRoot !== undefined ? stateRoot.asOpaque() : report.context.stateRoot,
    beefyRoot: beefyRoot !== undefined ? beefyRoot.asOpaque() : report.context.beefyRoot,
    lookupAnchor: lookupAnchor !== undefined ? lookupAnchor.asOpaque() : report.context.lookupAnchor,
    lookupAnchorSlot: lookupAnchorSlot ?? report.context.lookupAnchorSlot,
    prerequisites: prerequisites !== undefined ? prerequisites.map((x) => x.asOpaque()) : report.context.prerequisites,
  });
  return WorkReport.create({
    workPackageSpec: report.workPackageSpec,
    context,
    coreIndex: tryAsCoreIndex(core),
    authorizerHash: authorizer !== undefined ? authorizer.asOpaque() : report.authorizerHash,
    authorizationOutput: report.authorizationOutput,
    segmentRootLookup: report.segmentRootLookup,
    results: FixedSizeArray.new(
      report.results.map((x) =>
        WorkResult.create({
          serviceId: x.serviceId,
          codeHash: x.codeHash,
          payloadHash: x.payloadHash,
          gas: x.gas,
          result:
            resultSize !== undefined ? new WorkExecResult(WorkExecResultKind.ok, Bytes.fill(resultSize, 0)) : x.result,
          load: WorkRefineLoad.create({
            gasUsed: tryAsServiceGas(5),
            importedSegments: tryAsU32(0),
            exportedSegments: tryAsU32(0),
            extrinsicSize: tryAsU32(0),
            extrinsicCount: tryAsU32(0),
          }),
        }),
      ),
      report.results.fixedLength,
    ),
    authorizationGasUsed: tryAsServiceGas(1),
  });
}

export function guaranteesAsView(
  spec: ChainSpec,
  guarantees: readonly ReportGuarantee[],
  { disableCredentialsRangeCheck = false }: { disableCredentialsRangeCheck?: boolean } = {},
): GuaranteesExtrinsicView {
  if (disableCredentialsRangeCheck) {
    const fakeCodec = codecWithContext((context) =>
      codecKnownSizeArray(
        codec.Class(ReportGuarantee, {
          report: WorkReport.Codec,
          slot: codec.u32.asOpaque<TimeSlot>(),
          credentials: codecKnownSizeArray(Credential.Codec, {
            minLength: 0,
            maxLength: 5,
          }),
        }),
        {
          minLength: 0,
          maxLength: context.coresCount,
          typicalLength: context.coresCount,
        },
        GuaranteesExtrinsicBounds,
      ),
    );
    const encoded = Encoder.encodeObject(fakeCodec, asOpaqueType(guarantees), spec);
    return Decoder.decodeObject(fakeCodec.View, encoded, spec);
  }

  const encoded = Encoder.encodeObject(guaranteesExtrinsicCodec, asOpaqueType(guarantees), spec);
  return Decoder.decodeObject(guaranteesExtrinsicCodec.View, encoded, spec);
}

export async function newReports(options: Parameters<typeof newReportsState>[0] = {}) {
  const state = newReportsState(options);
  const headerChain = {
    isInChain(header: HeaderHash) {
      return state.recentBlocks.find((x) => x.headerHash.isEqualTo(header)) !== undefined;
    },
  };

  return new Reports(tinyChainSpec, state, await hasher, headerChain);
}

export function newCredential(index: number, signature?: Ed25519Signature) {
  return Credential.create({
    validatorIndex: tryAsValidatorIndex(index),
    signature: signature ?? Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
  });
}

type ReportStateOptions = {
  withCoreAssignment?: boolean;
  services?: ReportsState["services"];
  accumulationQueue?: NotYetAccumulatedReport[];
  recentlyAccumulated?: HashSet<WorkPackageHash>;
  reportedInRecentBlocks?: HashDictionary<WorkPackageHash, WorkPackageInfo>;
};

function newReportsState({
  withCoreAssignment = false,
  services = new Map(),
  accumulationQueue = [],
  recentlyAccumulated = HashSet.new(),
  reportedInRecentBlocks = HashDictionary.new(),
}: ReportStateOptions = {}): ReportsState {
  const spec = tinyChainSpec;
  return {
    accumulationQueue: tryAsPerEpochBlock(
      FixedSizeArray.fill((idx) => (idx === 0 ? accumulationQueue : []), spec.epochLength),
      spec,
    ),
    recentlyAccumulated: tryAsPerEpochBlock(
      FixedSizeArray.fill((idx) => (idx === 0 ? recentlyAccumulated : HashSet.new()), spec.epochLength),
      spec,
    ),
    availabilityAssignment: tryAsPerCore(withCoreAssignment ? initialAssignment() : [null, null], spec),
    currentValidatorData: tryAsPerValidator(initialValidators(), spec),
    previousValidatorData: tryAsPerValidator(initialValidators(), spec),
    entropy: getEntropy(1, 2, 3, 4),
    authPools: getAuthPools([1, 2, 3, 4], spec),
    recentBlocks: asKnownSize([
      {
        headerHash: Bytes.parseBytes(
          "0x168490e085497fcb6cbe3b220e2fa32456f30c1570412edd76ccb93be9254fef",
          HASH_SIZE,
        ).asOpaque(),
        mmr: { peaks: [] },
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: reportedInRecentBlocks,
      },
      {
        headerHash: Bytes.parseBytes(
          "0xc0564c5e0de0942589df4343ad1956da66797240e2a2f2d6f8116b5047768986",
          HASH_SIZE,
        ).asOpaque(),
        mmr: {
          peaks: [],
        },
        postStateRoot: Bytes.parseBytes(
          "0xf6967658df626fa39cbfb6014b50196d23bc2cfbfa71a7591ca7715472dd2b48",
          HASH_SIZE,
        ).asOpaque(),
        reported: HashDictionary.new(),
      },
      {
        headerHash: Bytes.parseBytes(
          "0x168490e085497fcb6cbe3b220e2fa32456f30c1570412edd76ccb93be9254fef",
          HASH_SIZE,
        ).asOpaque(),
        mmr: {
          peaks: [],
        },
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: HashDictionary.new(),
      },
    ]),
    services,
  };
}

function getAuthPools(source: number[], spec: ChainSpec): ReportsState["authPools"] {
  return tryAsPerCore(
    [
      asOpaqueType(source.map((x) => Bytes.fill(HASH_SIZE, x).asOpaque())),
      asOpaqueType(source.map((x) => Bytes.fill(HASH_SIZE, x).asOpaque())),
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

function newAvailabilityAssignment({ core, timeout }: { core: number; timeout: number }): AvailabilityAssignment {
  const workReport = newWorkReport({ core });
  const encoded = Encoder.encodeObject(WorkReport.Codec, workReport, tinyChainSpec);
  const hash = blake2b.hashBytes(encoded).asOpaque();
  const workReportWithHash = new WithHash(hash, workReport);

  return AvailabilityAssignment.create({ workReport: workReportWithHash, timeout: tryAsTimeSlot(timeout) });
}

function intoValidatorData({ bandersnatch, ed25519 }: { bandersnatch: string; ed25519: string }): ValidatorData {
  return ValidatorData.create({
    ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
    bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
    bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  });
}

export const initialAssignment = (): AvailabilityAssignment[] => [
  newAvailabilityAssignment({ core: 0, timeout: 11 }),
  newAvailabilityAssignment({ core: 1, timeout: 11 }),
];

export const initialValidators = (): ValidatorData[] =>
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
  ].map(intoValidatorData);

export const initialServices = ({ withDummyCodeHash = false } = {}): Map<ServiceId, Service> => {
  const m = new Map();
  const id = tryAsServiceId(129);
  m.set(
    id,
    new Service(tryAsServiceId(129), {
      preimages: HashDictionary.new(),
      storage: [],
      lookupHistory: HashDictionary.new(),
      info: ServiceAccountInfo.create({
        codeHash: withDummyCodeHash
          ? Bytes.fill(HASH_SIZE, 1).asOpaque()
          : Bytes.parseBytes(
              "0x8178abf4f459e8ed591be1f7f629168213a5ac2a487c28c0ef1a806198096c7a",
              HASH_SIZE,
            ).asOpaque(),
        balance: tryAsU64(0),
        accumulateMinGas: tryAsServiceGas(10_000),
        onTransferMinGas: tryAsServiceGas(0),
        storageUtilisationBytes: tryAsU64(1),
        storageUtilisationCount: tryAsU32(1),
      }),
    }),
  );
  return m;
};
