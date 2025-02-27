import type { EntropyHash } from "@typeberry/block";
import {
  B_I,
  B_L,
  B_S,
  C,
  D,
  E,
  G_A,
  G_I,
  G_R,
  G_T,
  H,
  I,
  J,
  L,
  O,
  P,
  Q,
  R,
  S,
  T,
  U,
  V,
  W_A,
  W_B,
  W_C,
  W_E,
  W_G,
  W_M,
  W_P,
  W_R,
  W_T,
  W_X,
  Y,
} from "@typeberry/block/gp-constants";
import { BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { FetchExternalities } from "@typeberry/jam-host-calls/fetch";
import { type U64, tryAsU16, tryAsU32, tryAsU64, u16AsLeBytes, u32AsLeBytes, u64AsLeBytes } from "@typeberry/numbers";
import { Operand } from "../operand";

const CONSTANTS_ENCODED = BytesBlob.blobFromParts(
  u64AsLeBytes(tryAsU64(B_I)),
  u64AsLeBytes(tryAsU64(B_L)),
  u64AsLeBytes(tryAsU64(B_S)),
  u16AsLeBytes(tryAsU16(C)),
  u32AsLeBytes(tryAsU32(D)),
  u32AsLeBytes(tryAsU32(E)),
  u64AsLeBytes(tryAsU64(G_A)),
  u64AsLeBytes(tryAsU64(G_I)),
  u64AsLeBytes(tryAsU64(G_R)),
  u64AsLeBytes(tryAsU64(G_T)),
  u16AsLeBytes(tryAsU16(H)),
  u16AsLeBytes(tryAsU16(I)),
  u16AsLeBytes(tryAsU16(J)),
  u32AsLeBytes(tryAsU32(L)),
  u16AsLeBytes(tryAsU16(O)),
  u16AsLeBytes(tryAsU16(P)),
  u16AsLeBytes(tryAsU16(Q)),
  u16AsLeBytes(tryAsU16(R)),
  u16AsLeBytes(tryAsU16(S)),
  u16AsLeBytes(tryAsU16(T)),
  u16AsLeBytes(tryAsU16(U)),
  u16AsLeBytes(tryAsU16(V)),
  u32AsLeBytes(tryAsU32(W_A)),
  u32AsLeBytes(tryAsU32(W_B)),
  u32AsLeBytes(tryAsU32(W_C)),
  u32AsLeBytes(tryAsU32(W_E)),
  u32AsLeBytes(tryAsU32(W_G)),
  u32AsLeBytes(tryAsU32(W_M)),
  u32AsLeBytes(tryAsU32(W_P)),
  u32AsLeBytes(tryAsU32(W_R)),
  u32AsLeBytes(tryAsU32(W_T)),
  u32AsLeBytes(tryAsU32(W_X)),
  u32AsLeBytes(tryAsU32(Y)),
);

export class AccumulateFetchExternalities implements FetchExternalities {
  constructor(
    private entropyHash: EntropyHash,
    private operands: Operand[],
    private chainSpec: ChainSpec,
  ) {}

  constants(): BytesBlob {
    return CONSTANTS_ENCODED;
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
    return Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), this.operands, this.chainSpec);
  }

  oneOperand(operandIndex: U64): BytesBlob | null {
    const operand = this.operands[Number(operandIndex)];
    return Encoder.encodeObject(Operand.Codec, operand, this.chainSpec);
  }

  allTransfers(): BytesBlob | null {
    return null;
  }

  oneTransfer(_transferIndex: U64): BytesBlob | null {
    return null;
  }
}
