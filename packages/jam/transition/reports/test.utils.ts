import {
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
import { codecKnownSizeArray, codecWithContext } from "@typeberry/block/codec.js";
import {
  Credential,
  GuaranteesExtrinsicBounds,
  type GuaranteesExtrinsicView,
  guaranteesExtrinsicCodec,
  ReportGuarantee,
} from "@typeberry/block/guarantees.js";
import { RefineContext, type WorkPackageHash, type WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { testWorkReportHex } from "@typeberry/block/test-helpers.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray, HashDictionary } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set.js";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  ED25519_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
  type Ed25519Signature,
} from "@typeberry/crypto";
import { Blake2b, HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  AvailabilityAssignment,
  ENTROPY_ENTRIES,
  InMemoryService,
  InMemoryState,
  ServiceAccountInfo,
  tryAsPerCore,
  VALIDATOR_META_BYTES,
  ValidatorData,
} from "@typeberry/state";
import type { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";
import { RecentBlocks, RecentBlocksHistory } from "@typeberry/state/recent-blocks.js";
import { asOpaqueType } from "@typeberry/utils";
import { Reports, type ReportsState } from "./reports.js";
import type { HeaderChain } from "./verify-contextual.js";

export const ENTROPY = getEntropy(1, 2, 3, 4);

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
  const source = BytesBlob.parseBlob(testWorkReportHex());
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
  const blake2b = await Blake2b.createHasher();
  const state = newReportsState(options);
  const headerChain: HeaderChain = {
    isAncestor() {
      return false;
    },
  };

  return new Reports(tinyChainSpec, blake2b, state, headerChain);
}

export function newCredential(index: number, signature?: Ed25519Signature) {
  return Credential.create({
    validatorIndex: tryAsValidatorIndex(index),
    signature: signature ?? Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
  });
}

type ReportStateOptions = {
  withCoreAssignment?: boolean;
  services?: InMemoryState["services"];
  accumulationQueue?: NotYetAccumulatedReport[];
  recentlyAccumulated?: HashSet<WorkPackageHash>;
  reportedInRecentBlocks?: HashDictionary<WorkPackageHash, WorkPackageInfo>;
  clearAvailabilityOnZero?: boolean;
};

function newReportsState({
  withCoreAssignment = false,
  services = new Map(),
  accumulationQueue = [],
  recentlyAccumulated = HashSet.new(),
  reportedInRecentBlocks = HashDictionary.new(),
  clearAvailabilityOnZero = false,
}: ReportStateOptions = {}): ReportsState {
  const spec = tinyChainSpec;
  const coreAssignment = withCoreAssignment ? initialAssignment() : [null, null];
  if (clearAvailabilityOnZero) {
    coreAssignment[0] = null;
  }
  return InMemoryState.partial(spec, {
    accumulationQueue: tryAsPerEpochBlock(
      FixedSizeArray.fill((idx) => (idx === 0 ? accumulationQueue : []), spec.epochLength),
      spec,
    ),
    recentlyAccumulated: tryAsPerEpochBlock(
      FixedSizeArray.fill((idx) => (idx === 0 ? recentlyAccumulated : HashSet.new()), spec.epochLength),
      spec,
    ),
    availabilityAssignment: tryAsPerCore(coreAssignment, spec),
    currentValidatorData: tryAsPerValidator(initialValidators(), spec),
    previousValidatorData: tryAsPerValidator(initialValidators(), spec),
    entropy: ENTROPY,
    authPools: getAuthPools([1, 2, 3, 4], spec),
    recentBlocks: RecentBlocksHistory.create(
      RecentBlocks.create({
        blocks: asKnownSize([
          {
            headerHash: Bytes.parseBytes(
              "0x168490e085497fcb6cbe3b220e2fa32456f30c1570412edd76ccb93be9254fef",
              HASH_SIZE,
            ).asOpaque(),
            accumulationResult: Bytes.parseBytes(
              "0x675f9e53123c83ddcdb2c1f5231f13646378aefc83837a4571d052ac80014837",
              HASH_SIZE,
            ).asOpaque(),
            postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
            reported: reportedInRecentBlocks,
          },
          {
            headerHash: Bytes.parseBytes(
              "0xbed5792b7df998e5520dfbb8c91386cf2117b2c07b7837094c79d5c0b4de9de7",
              HASH_SIZE,
            ).asOpaque(),
            accumulationResult: Bytes.parseBytes(
              "0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5",
              HASH_SIZE,
            ).asOpaque(),
            postStateRoot: Bytes.parseBytes(
              "0x1324bad2e35946c1a95dd25380a6e9199fbd40045ae49eacfc67599cbd23cda7",
              HASH_SIZE,
            ).asOpaque(),
            reported: HashDictionary.new(),
          },
          {
            headerHash: Bytes.parseBytes(
              "0xc0564c5e0de0942589df4343ad1956da66797240e2a2f2d6f8116b5047768986",
              HASH_SIZE,
            ).asOpaque(),
            accumulationResult: Bytes.zero(HASH_SIZE),
            postStateRoot: Bytes.parseBytes(
              "0xf6967658df626fa39cbfb6014b50196d23bc2cfbfa71a7591ca7715472dd2b48",
              HASH_SIZE,
            ).asOpaque(),
            reported: HashDictionary.new(),
          },
        ]),
        accumulationLog: {
          peaks: [
            Bytes.zero(HASH_SIZE),
            Bytes.parseBytes("0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5", HASH_SIZE),
          ],
        },
      }),
    ),
    services,
  });
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
  return AvailabilityAssignment.create({ workReport, timeout: tryAsTimeSlot(timeout) });
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

export const initialServices = ({ withDummyCodeHash = false } = {}): Map<ServiceId, InMemoryService> => {
  const m = new Map();
  const id = tryAsServiceId(129);
  m.set(
    id,
    new InMemoryService(tryAsServiceId(129), {
      preimages: HashDictionary.new(),
      storage: new Map(),
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
        gratisStorage: tryAsU64(0),
        created: tryAsTimeSlot(0),
        lastAccumulation: tryAsTimeSlot(0),
        parentService: tryAsServiceId(0),
      }),
    }),
  );
  return m;
};
