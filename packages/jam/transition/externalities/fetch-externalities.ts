import type { EntropyHash } from "@typeberry/block";
import {
  G_I,
  MAX_REPORT_DEPENDENCIES,
  O,
  Q,
  T,
  W_A,
  W_B,
  W_C,
  W_M,
  W_R,
  W_T,
  W_X,
} from "@typeberry/block/gp-constants.js";
import { MAX_NUMBER_OF_WORK_ITEMS } from "@typeberry/block/work-package.js";
import type { BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { type general, PendingTransfer } from "@typeberry/jam-host-calls";
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

enum TransferOperandKind {
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

const TRANSFER_OR_OPERAND = codec.custom<TransferOrOperand>(
  {
    name: "TransferOrOperand",
    sizeHint: { bytes: 1, isExact: false },
  },
  (e, x) => {
    e.varU32(tryAsU32(x.kind));
    if (x.kind === TransferOperandKind.OPERAND) {
      e.object(Operand.Codec, x.value);
    }

    if (x.kind === TransferOperandKind.TRANSFER) {
      e.object(PendingTransfer.Codec, x.value);
    }
  },
  (d) => {
    const kind = d.varU32();
    if (kind === TransferOperandKind.OPERAND) {
      return {
        kind: TransferOperandKind.OPERAND,
        value: d.object(Operand.Codec),
      };
    }

    if (kind === TransferOperandKind.TRANSFER) {
      return { kind: TransferOperandKind.TRANSFER, value: d.object(PendingTransfer.Codec) };
    }

    throw new Error(`Unable to decode TransferOrOperand. Invalid kind: ${kind}.`);
  },
  (s) => {
    const kind = s.decoder.varU32();
    if (kind === TransferOperandKind.OPERAND) {
      s.object(Operand.Codec);
    }

    if (kind === TransferOperandKind.TRANSFER) {
      s.object(PendingTransfer.Codec);
    }
  },
);

const TRANSFERS_AND_OPERANDS = codec.sequenceVarLen(TRANSFER_OR_OPERAND);

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

function getEncodedConstants(chainSpec: ChainSpec) {
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
    W_R: tryAsU32(W_R),
    W_T: tryAsU32(W_T),
    W_X: tryAsU32(W_X),
    Y: tryAsU32(chainSpec.contestLength),
  });

  encodedConstantsCache.set(chainSpec, encodedConsts);

  return encodedConsts;
}

enum FetchContext {
  Accumulate = 0,
  /** @deprecated since 0.7.1 */
  LegacyAccumulate = 1,
  /** @deprecated since 0.7.1 */
  LegacyOnTransfer = 2,
}

type LegacyAccumulateFetchData = {
  context: FetchContext.LegacyAccumulate;
  entropy: EntropyHash;
  operands: Operand[];
};

type LegacyOnTransferFetchData = {
  context: FetchContext.LegacyOnTransfer;
  entropy: EntropyHash;
  transfers: PendingTransfer[];
};

type AccumulateFetchData = {
  context: FetchContext.Accumulate;
  entropy: EntropyHash;
  transfers: PendingTransfer[];
  operands: Operand[];
};

type FetchData = LegacyAccumulateFetchData | LegacyOnTransferFetchData | AccumulateFetchData;

export class FetchExternalities implements general.IFetchExternalities {
  private constructor(
    private fetchData: FetchData,
    private chainSpec: ChainSpec,
  ) {}
  static createForPre071Accumulate(
    fetchData: Omit<LegacyAccumulateFetchData, "context">,
    chainSpec: ChainSpec,
  ): FetchExternalities {
    return new FetchExternalities({ context: FetchContext.LegacyAccumulate, ...fetchData }, chainSpec);
  }

  static createForAccumulate(
    fetchData: Omit<AccumulateFetchData, "context">,
    chainSpec: ChainSpec,
  ): FetchExternalities {
    return new FetchExternalities({ context: FetchContext.Accumulate, ...fetchData }, chainSpec);
  }

  static createForOnTransfer(
    fetchData: Omit<LegacyOnTransferFetchData, "context">,
    chainSpec: ChainSpec,
  ): FetchExternalities {
    return new FetchExternalities({ context: FetchContext.LegacyOnTransfer, ...fetchData }, chainSpec);
  }

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  entropy(): BytesBlob | null {
    const { entropy } = this.fetchData;
    if (entropy === undefined) {
      return null;
    }

    return entropy.asOpaque();
  }

  authorizerTrace(): BytesBlob | null {
    return null;
  }

  workItemExtrinsic(_workItem: U64 | null, _index: U64): BytesBlob | null {
    return null;
  }

  workItemImport(_workItem: U64 | null, _index: U64): BytesBlob | null {
    return null;
  }

  workPackage(): BytesBlob | null {
    return null;
  }

  authorizer(): BytesBlob | null {
    return null;
  }

  authorizationToken(): BytesBlob | null {
    return null;
  }

  refineContext(): BytesBlob | null {
    return null;
  }

  allWorkItems(): BytesBlob | null {
    return null;
  }

  oneWorkItem(_workItem: U64): BytesBlob | null {
    return null;
  }

  workItemPayload(_workItem: U64): BytesBlob | null {
    return null;
  }

  allOperands(): BytesBlob | null {
    if (this.fetchData.context === FetchContext.LegacyAccumulate) {
      const operands = this.fetchData.operands;

      return Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), operands, this.chainSpec);
    }

    return null;
  }

  oneOperand(operandIndex: U64): BytesBlob | null {
    if (this.fetchData.context === FetchContext.LegacyAccumulate) {
      const { operands } = this.fetchData;

      if (operandIndex >= 2n ** 32n) {
        return null;
      }

      const operand = operands[Number(operandIndex)];

      if (operand === undefined) {
        return null;
      }

      return Encoder.encodeObject(Operand.Codec, operand, this.chainSpec);
    }

    return null;
  }

  allTransfers(): BytesBlob | null {
    if (this.fetchData.context === FetchContext.LegacyOnTransfer) {
      const { transfers } = this.fetchData;

      return Encoder.encodeObject(codec.sequenceVarLen(PendingTransfer.Codec), transfers, this.chainSpec);
    }

    return null;
  }

  oneTransfer(transferIndex: U64): BytesBlob | null {
    if (this.fetchData.context === FetchContext.LegacyOnTransfer) {
      const { transfers } = this.fetchData;

      if (transferIndex >= 2n ** 32n) {
        return null;
      }

      const transfer = transfers[Number(transferIndex)];

      if (transfer === undefined) {
        return null;
      }

      return Encoder.encodeObject(PendingTransfer.Codec, transfer, this.chainSpec);
    }

    return null;
  }

  allTransfersAndOperands(): BytesBlob | null {
    if (this.fetchData.context === FetchContext.Accumulate) {
      const { transfers, operands } = this.fetchData;
      const transfersAndOperands: TransferOrOperand[] = transfers
        .map((transfer): TransferOrOperand => ({ kind: TransferOperandKind.TRANSFER, value: transfer }))
        .concat(operands.map((operand): TransferOrOperand => ({ kind: TransferOperandKind.OPERAND, value: operand })));

      return Encoder.encodeObject(TRANSFERS_AND_OPERANDS, transfersAndOperands, this.chainSpec);
    }

    return null;
  }

  oneTransferOrOperand(index: U64): BytesBlob | null {
    if (this.fetchData.context === FetchContext.Accumulate) {
      const { operands, transfers } = this.fetchData;

      if (index >= operands.length + transfers.length) {
        return null;
      }

      const kind = index < operands.length ? TransferOperandKind.OPERAND : TransferOperandKind.TRANSFER;
      const transferOrOperand =
        kind === TransferOperandKind.OPERAND
          ? ({ kind: TransferOperandKind.OPERAND, value: operands[Number(index)] } as const)
          : ({ kind: TransferOperandKind.TRANSFER, value: transfers[Number(index) - operands.length] } as const);

      if (transferOrOperand.value === undefined) {
        return null;
      }

      return Encoder.encodeObject(TRANSFER_OR_OPERAND, transferOrOperand, this.chainSpec);
    }

    return null;
  }
}
