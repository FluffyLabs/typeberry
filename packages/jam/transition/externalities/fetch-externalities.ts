import { type CodeHash, reencodeAsView, type ServiceGas, type ServiceId } from "@typeberry/block";
import { G_I, MAX_REPORT_DEPENDENCIES, O, Q, T, W_A, W_B, W_C, W_M, W_T, W_X } from "@typeberry/block/gp-constants.js";
import type { WorkItem } from "@typeberry/block/work-item.js";
import { MAX_NUMBER_OF_WORK_ITEMS, WorkPackage, type WorkPackageView } from "@typeberry/block/work-package.js";
import { BytesBlob } from "@typeberry/bytes";
import { codec, Decoder, type DescribedBy, Encoder, SequenceView } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { PendingTransfer } from "@typeberry/jam-host-calls";
import { tryAsU16, tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import {
  BASE_SERVICE_BALANCE,
  ELECTIVE_BYTE_BALANCE,
  ELECTIVE_ITEM_BALANCE,
  MAX_RECENT_HISTORY,
} from "@typeberry/state";
import { GAS_TO_INVOKE_WORK_REPORT } from "../accumulate/accumulate-state.js";
import { Operand } from "../accumulate/operand.js";
import { REPORT_TIMEOUT_GRACE_PERIOD } from "../assurances.js";
import { MAX_WORK_REPORT_SIZE_BYTES } from "../reports/verify-basic.js";

export enum TransferOperandKind {
  OPERAND = 0,
  TRANSFER = 1,
}

export type TransferOrOperand =
  | {
      kind: TransferOperandKind.OPERAND;
      value: Operand;
    }
  | {
      kind: TransferOperandKind.TRANSFER;
      value: PendingTransfer;
    };

export const TRANSFER_OR_OPERAND = codec.union<TransferOperandKind, TransferOrOperand>("TransferOrOperand", {
  [TransferOperandKind.OPERAND]: codec.object({ value: Operand.Codec }),
  [TransferOperandKind.TRANSFER]: codec.object({ value: PendingTransfer.Codec }),
});

export const TRANSFERS_AND_OPERANDS = codec.sequenceVarLen(TRANSFER_OR_OPERAND);

// https://github.com/gavofyork/graypaper/pull/414
// 0.7.0 encoding is used for prior versions as well.
const CONSTANTS_CODEC = codec.object({
  B_I: codec.u64,
  B_L: codec.u64,
  B_S: codec.u64,
  C: codec.u16,
  D: codec.u32,
  E: codec.u32,
  G_A: codec.u64,
  G_I: codec.u64,
  G_R: codec.u64,
  G_T: codec.u64,
  H: codec.u16,
  I: codec.u16,
  J: codec.u16,
  K: codec.u16,
  L: codec.u32,
  N: codec.u16,
  O: codec.u16,
  P: codec.u16,
  Q: codec.u16,
  R: codec.u16,
  T: codec.u16,
  U: codec.u16,
  V: codec.u16,
  W_A: codec.u32,
  W_B: codec.u32,
  W_C: codec.u32,
  W_E: codec.u32,
  W_M: codec.u32,
  W_P: codec.u32,
  W_R: codec.u32,
  W_T: codec.u32,
  W_X: codec.u32,
  Y: codec.u32,
});

const encodedConstantsCache = new Map<ChainSpec, BytesBlob>();

export function getEncodedConstants(chainSpec: ChainSpec) {
  const constsFromCache = encodedConstantsCache.get(chainSpec);
  if (constsFromCache !== undefined) {
    return constsFromCache;
  }

  const encodedConsts = Encoder.encodeObject(CONSTANTS_CODEC, {
    B_I: tryAsU64(ELECTIVE_ITEM_BALANCE),
    B_L: tryAsU64(ELECTIVE_BYTE_BALANCE),
    B_S: tryAsU64(BASE_SERVICE_BALANCE),
    C: tryAsU16(chainSpec.coresCount),
    D: tryAsU32(chainSpec.preimageExpungePeriod),
    E: tryAsU32(chainSpec.epochLength),
    G_A: tryAsU64(GAS_TO_INVOKE_WORK_REPORT),
    G_I: tryAsU64(G_I),
    G_R: tryAsU64(chainSpec.maxRefineGas),
    G_T: tryAsU64(chainSpec.maxBlockGas),
    H: tryAsU16(MAX_RECENT_HISTORY),
    I: tryAsU16(MAX_NUMBER_OF_WORK_ITEMS),
    J: tryAsU16(MAX_REPORT_DEPENDENCIES),
    K: tryAsU16(chainSpec.maxTicketsPerExtrinsic),
    L: tryAsU32(chainSpec.maxLookupAnchorAge),
    N: tryAsU16(chainSpec.ticketsPerValidator),
    O: tryAsU16(O),
    P: tryAsU16(chainSpec.slotDuration),
    Q: tryAsU16(Q),
    R: tryAsU16(chainSpec.rotationPeriod),
    T: tryAsU16(T),
    U: tryAsU16(REPORT_TIMEOUT_GRACE_PERIOD),
    V: chainSpec.validatorsCount,
    W_A: tryAsU32(W_A),
    W_B: tryAsU32(W_B),
    W_C: tryAsU32(W_C),
    W_E: tryAsU32(chainSpec.erasureCodedPieceSize),
    W_M: tryAsU32(W_M),
    W_P: tryAsU32(chainSpec.numberECPiecesPerSegment),
    W_R: tryAsU32(MAX_WORK_REPORT_SIZE_BYTES),
    W_T: tryAsU32(W_T),
    W_X: tryAsU32(W_X),
    Y: tryAsU32(chainSpec.contestLength),
  });

  encodedConstantsCache.set(chainSpec, encodedConsts);

  return encodedConsts;
}

/**
 * `S(w)` — work-item summary used by fetch in both the IsAuthorized
 * and Refine contexts.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/31fc0231fc02?v=0.7.2
 */
const WORK_ITEM_SUMMARY_CODEC = codec.object({
  service: codec.u32.asOpaque<ServiceId>(),
  codeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
  refineGasLimit: codec.u64.asOpaque<ServiceGas>(),
  accumulateGasLimit: codec.u64.asOpaque<ServiceGas>(),
  exportCount: codec.u16,
  importSegmentsCount: codec.u16,
  extrinsicCount: codec.u16,
  payloadLength: codec.u32,
});
type WorkItemSummary = DescribedBy<typeof WORK_ITEM_SUMMARY_CODEC>;
type WorkItemSummaryView = DescribedBy<typeof WORK_ITEM_SUMMARY_CODEC.View>;

export function encodeWorkItemSummary(item: WorkItem): BytesBlob {
  return Encoder.encodeObject(WORK_ITEM_SUMMARY_CODEC, {
    service: item.service,
    codeHash: item.codeHash,
    refineGasLimit: item.refineGasLimit,
    accumulateGasLimit: item.accumulateGasLimit,
    exportCount: item.exportCount,
    importSegmentsCount: tryAsU16(item.importSegments.length),
    extrinsicCount: tryAsU16(item.extrinsic.length),
    payloadLength: tryAsU32(item.payload.length),
  });
}

/** Encoded work package data for fetch, shared between `IsAuthorized` and `Refine` fetchers. */
export type WorkPackageFetchData = {
  /** Lazy view over the encoded work package. */
  packageView: WorkPackageView;
  /** SequenceView over the concatenated S(w) summaries. */
  workItemSummaries: SequenceView<WorkItemSummary, WorkItemSummaryView>;
};

/** Eagerly build the per-package fetch views. */
export function buildWorkPackageFetchData(chainSpec: ChainSpec, workPackage: WorkPackage): WorkPackageFetchData {
  const packageView = reencodeAsView(WorkPackage.Codec, workPackage, chainSpec);

  const summariesBlob = BytesBlob.blobFromParts(workPackage.items.map((i) => encodeWorkItemSummary(i).raw));

  const workItemSummaries = new SequenceView(
    Decoder.fromBytesBlob(summariesBlob),
    WORK_ITEM_SUMMARY_CODEC,
    workPackage.items.length,
  );

  return { packageView, workItemSummaries };
}

/** Converts u64 value taken from a register into valid index of array of given `length`. */
export function u64ToArrayIndex(v: U64, len: number): number | null {
  return v < BigInt(len) ? Number(v) : null;
}
