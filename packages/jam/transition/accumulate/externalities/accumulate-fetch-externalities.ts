import type { EntropyHash } from "@typeberry/block";
import {
  G_I,
  G_R,
  MAX_REPORT_DEPENDENCIES,
  O,
  Q,
  S,
  W_B,
  W_C,
  W_E,
  W_G,
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
import type { FetchExternalities } from "@typeberry/jam-host-calls/fetch.js";
import { type U64, tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  BASE_SERVICE_BALANCE,
  ELECTIVE_BYTE_BALANCE,
  ELECTIVE_ITEM_BALANCE,
  MAX_RECENT_HISTORY,
} from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { REPORT_TIMEOUT_GRACE_PERIOD } from "../../assurances.js";
import { L } from "../../reports/verify-contextual.js";
import { ACCUMULATE_TOTAL_GAS, GAS_TO_INVOKE_WORK_REPORT } from "../accumulate.js";
import { Operand, Operand_0_6_4 } from "../operand.js";

// TODO [ToDr] this is a bit bullshit for now, it's based on the GP,
// yet it does not match what the 0.6.6 test vectors expect, so the
// values for these are hand picked in the constant implementation
// to make it work, so take a look at the comments there.
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
  // K: codec.u16, // GP0.7.0
  L: codec.u32,
  // N: codec.u16, // GP0.7.0
  O: codec.u16,
  P: codec.u16,
  Q: codec.u16,
  R: codec.u16,
  S: codec.u16, // not in gp0.7.0
  T: codec.u16,
  U: codec.u16,
  V: codec.u16,
  W_A: codec.u16,
  W_B: codec.u32,
  W_C: codec.u32,
  W_E: codec.u32,
  W_G: codec.u32, // not in gp0.7.0
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
    C: tryAsU16(chainSpec.coresCount), //cores count (precise)
    D: tryAsU32(chainSpec.preimageExpungePeriod),
    E: tryAsU32(chainSpec.epochLength), // epoch period (precise)
    G_A: tryAsU64(GAS_TO_INVOKE_WORK_REPORT),
    G_I: tryAsU64(G_I),
    G_R: tryAsU64(G_R),
    G_T: tryAsU64(ACCUMULATE_TOTAL_GAS),
    H: tryAsU16(MAX_RECENT_HISTORY),
    I: tryAsU16(MAX_NUMBER_OF_WORK_ITEMS),
    J: tryAsU16(MAX_REPORT_DEPENDENCIES),
    // K: tryAsU16(K), // GP 0.7.0
    L: tryAsU32(L),
    // N: tryAsU16(N), // GP 0.7.0
    O: tryAsU16(O),
    P: tryAsU16(chainSpec.slotDuration),
    Q: tryAsU16(Q),
    R: tryAsU16(0), /// ???
    S: tryAsU16(S),
    T: tryAsU16(chainSpec.rotationPeriod), // rotation period (precise)
    U: tryAsU16(REPORT_TIMEOUT_GRACE_PERIOD),
    V: tryAsU16(0),
    W_A: tryAsU16(chainSpec.validatorsCount), // validators count (precise)
    W_B: tryAsU32(W_B),
    W_C: tryAsU32(W_C),
    W_E: tryAsU32(W_E),
    W_G: tryAsU32(W_G), // basic piece len (precise)
    W_M: tryAsU32(W_M),
    W_P: tryAsU32(W_P),
    W_R: tryAsU32(W_R),
    W_T: tryAsU32(W_T), // transfer memo bytes (precise)
    W_X: tryAsU32(W_X),
    Y: tryAsU32(chainSpec.contestLength), // epoch tail start (precise)
  });

  encodedConstantsCache.set(chainSpec, encodedConsts);

  return encodedConsts;
}

// TODO [ToDr] This needs implementation for other context (refine, auth, on_transfer, etc)
// and should also be moved to general `externalities` folder.
export class AccumulateFetchExternalities implements FetchExternalities {
  constructor(
    private entropyHash: EntropyHash,
    private operands: Operand[],
    private chainSpec: ChainSpec,
  ) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  entropy(): BytesBlob | null {
    return this.entropyHash.asOpaque();
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

  allOperands(): BytesBlob {
    return Compatibility.is(GpVersion.V0_6_4)
      ? Encoder.encodeObject(codec.sequenceVarLen(Operand_0_6_4.Codec), this.operands, this.chainSpec)
      : Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), this.operands, this.chainSpec);
  }

  oneOperand(operandIndex: U64): BytesBlob | null {
    if (operandIndex >= 2n ** 32n) {
      return null;
    }

    const operand = this.operands[Number(operandIndex)];

    if (operand === undefined) {
      return null;
    }

    return Compatibility.isGreaterOrEqual(GpVersion.V0_6_5)
      ? Encoder.encodeObject(Operand.Codec, operand, this.chainSpec)
      : Encoder.encodeObject(Operand_0_6_4.Codec, operand, this.chainSpec);
  }

  allTransfers(): BytesBlob | null {
    return null;
  }

  oneTransfer(_transferIndex: U64): BytesBlob | null {
    return null;
  }
}
