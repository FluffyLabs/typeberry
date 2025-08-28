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
import { Compatibility, GpVersion } from "@typeberry/utils";
import { ACCUMULATE_TOTAL_GAS, GAS_TO_INVOKE_WORK_REPORT } from "../accumulate/accumulate.js";
import { Operand, Operand_0_6_4 } from "../accumulate/operand.js";
import { REPORT_TIMEOUT_GRACE_PERIOD } from "../assurances.js";
import { L } from "../reports/verify-contextual.js";

// https://github.com/gavofyork/graypaper/pull/414
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
  K: codec.u16, // GP0.7.0
  L: codec.u32,
  N: codec.u16, // GP0.7.0
  O: codec.u16,
  P: codec.u16,
  Q: codec.u16,
  R: codec.u16,
  //S: codec.u16, // not in gp0.7.0
  T: codec.u16,
  U: codec.u16,
  V: codec.u16,
  W_A: codec.u32,
  W_B: codec.u32,
  W_C: codec.u32,
  W_E: codec.u32,
  //W_G: codec.u32, // not in gp0.7.0
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
    B_I: tryAsU64(ELECTIVE_ITEM_BALANCE), // ok
    B_L: tryAsU64(ELECTIVE_BYTE_BALANCE), // ok
    B_S: tryAsU64(BASE_SERVICE_BALANCE), // ok
    C: tryAsU16(chainSpec.coresCount), //cores count (precise) - ok
    D: tryAsU32(chainSpec.preimageExpungePeriod), // ok
    E: tryAsU32(chainSpec.epochLength), // epoch period (precise) - ok
    G_A: tryAsU64(GAS_TO_INVOKE_WORK_REPORT), // ok
    G_I: tryAsU64(G_I), // ok
    G_R: tryAsU64(G_R), // ok
    G_T: tryAsU64(ACCUMULATE_TOTAL_GAS), // ok
    H: tryAsU16(MAX_RECENT_HISTORY), // ok
    I: tryAsU16(MAX_NUMBER_OF_WORK_ITEMS), //ok
    J: tryAsU16(MAX_REPORT_DEPENDENCIES), // ok
    K: tryAsU16(K), // GP 0.7.0
    L: tryAsU32(L), // ok
    N: tryAsU16(N), // GP 0.7.0
    O: tryAsU16(O), // ok
    P: tryAsU16(chainSpec.slotDuration), // ok
    Q: tryAsU16(Q), // ok
    R: tryAsU16(chainSpec.rotationPeriod), // ok (? had to modify)
    // S: tryAsU16(S), // had to remove
    T: tryAsU16(T), // rotation period (precise) - had to modify
    U: tryAsU16(REPORT_TIMEOUT_GRACE_PERIOD), // ok
    V: tryAsU16(chainSpec.validatorsCount), // had to move from W_A to V
    W_A: tryAsU32(W_A), // validators count (precise) - had to change from u16 to u32 and apply W_A from gp-constants.ts
    W_B: tryAsU32(W_B), // ok
    W_C: tryAsU32(W_C), // ok
    W_E: tryAsU32(W_E), // ok
    // W_G: tryAsU32(W_G), // basic piece len (precise) - had to remove
    W_M: tryAsU32(W_M), // ok
    W_P: tryAsU32(W_P), // ok
    W_R: tryAsU32(W_R), // ok
    W_T: tryAsU32(W_T), // transfer memo bytes (precise) - ok
    W_X: tryAsU32(W_X), // ok
    Y: tryAsU32(chainSpec.contestLength), // epoch tail start (precise) - ok
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

    return Compatibility.is(GpVersion.V0_6_4)
      ? Encoder.encodeObject(codec.sequenceVarLen(Operand_0_6_4.Codec), operands, this.chainSpec)
      : Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), operands, this.chainSpec);
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

    return Compatibility.isGreaterOrEqual(GpVersion.V0_6_5)
      ? Encoder.encodeObject(Operand.Codec, operand, this.chainSpec)
      : Encoder.encodeObject(Operand_0_6_4.Codec, operand, this.chainSpec);
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
