import type { EntropyHash } from "@typeberry/block";
import {
  G_I,
  G_R,
  K,
  MAX_REPORT_DEPENDENCIES,
  N,
  O,
  Q,
  T,
  W_A,
  W_B,
  W_C,
  W_E,
  W_M,
  W_P,
  W_R,
  W_T,
  W_X,
} from "@typeberry/block/gp-constants.js";
import { MAX_NUMBER_OF_WORK_ITEMS } from "@typeberry/block/work-package.js";
import type { BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import type { IFetchExternalities } from "@typeberry/jam-host-calls/fetch.js";
import { type U64, tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  BASE_SERVICE_BALANCE,
  ELECTIVE_BYTE_BALANCE,
  ELECTIVE_ITEM_BALANCE,
  MAX_RECENT_HISTORY,
} from "@typeberry/state";
import { ACCUMULATE_TOTAL_GAS, GAS_TO_INVOKE_WORK_REPORT } from "../accumulate/accumulate.js";
import { Operand } from "../accumulate/operand.js";
import { REPORT_TIMEOUT_GRACE_PERIOD } from "../assurances.js";
import { L } from "../reports/verify-contextual.js";

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
    G_R: tryAsU64(G_R),
    G_T: tryAsU64(ACCUMULATE_TOTAL_GAS),
    H: tryAsU16(MAX_RECENT_HISTORY),
    I: tryAsU16(MAX_NUMBER_OF_WORK_ITEMS),
    J: tryAsU16(MAX_REPORT_DEPENDENCIES),
    K: tryAsU16(K),
    L: tryAsU32(L),
    N: tryAsU16(N),
    O: tryAsU16(O),
    P: tryAsU16(chainSpec.slotDuration),
    Q: tryAsU16(Q),
    R: tryAsU16(chainSpec.rotationPeriod),
    T: tryAsU16(T),
    U: tryAsU16(REPORT_TIMEOUT_GRACE_PERIOD),
    V: tryAsU16(chainSpec.validatorsCount),
    W_A: tryAsU32(W_A),
    W_B: tryAsU32(W_B),
    W_C: tryAsU32(W_C),
    W_E: tryAsU32(W_E),
    W_M: tryAsU32(W_M),
    W_P: tryAsU32(W_P),
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
  OnTransfer = 1,
}

type AccumulateFetchData = {
  context: FetchContext.Accumulate;
  entropy: EntropyHash;
  operands: Operand[];
};

type OnTransferFetchData = {
  context: FetchContext.OnTransfer;
  entropy: EntropyHash;
  transfers: PendingTransfer[];
};

type FetchData = AccumulateFetchData | OnTransferFetchData;

export class FetchExternalities implements IFetchExternalities {
  private constructor(
    private fetchData: FetchData,
    private chainSpec: ChainSpec,
  ) {}

  static createForAccumulate(
    fetchData: Omit<AccumulateFetchData, "context">,
    chainSpec: ChainSpec,
  ): FetchExternalities {
    return new FetchExternalities({ context: FetchContext.Accumulate, ...fetchData }, chainSpec);
  }

  static createForOnTransfer(
    fetchData: Omit<OnTransferFetchData, "context">,
    chainSpec: ChainSpec,
  ): FetchExternalities {
    return new FetchExternalities({ context: FetchContext.OnTransfer, ...fetchData }, chainSpec);
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
    if (this.fetchData.context !== FetchContext.Accumulate) {
      return null;
    }

    const operands = this.fetchData.operands;

    return Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), operands, this.chainSpec);
  }

  oneOperand(operandIndex: U64): BytesBlob | null {
    if (this.fetchData.context !== FetchContext.Accumulate) {
      return null;
    }

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

  allTransfers(): BytesBlob | null {
    if (this.fetchData.context !== FetchContext.OnTransfer) {
      return null;
    }

    const { transfers } = this.fetchData;

    return Encoder.encodeObject(codec.sequenceVarLen(PendingTransfer.Codec), transfers, this.chainSpec);
  }

  oneTransfer(transferIndex: U64): BytesBlob | null {
    if (this.fetchData.context !== FetchContext.OnTransfer) {
      return null;
    }

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
}
