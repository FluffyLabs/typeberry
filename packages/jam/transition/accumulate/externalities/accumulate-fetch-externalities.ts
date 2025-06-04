import type { EntropyHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { FetchExternalities } from "@typeberry/jam-host-calls/fetch";
import type { U64 } from "@typeberry/numbers";
import { Operand } from "../operand";

export class AccumulateFetchExternalities implements FetchExternalities {
  constructor(
    private entropyHash: EntropyHash,
    private operands: Operand[],
    private chainSpec: ChainSpec,
  ) {}

  constants(): BytesBlob {
    throw new Error("Method not implemented.");
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
    if (operandIndex >= 2n ** 32n) {
      return null;
    }

    const operand = this.operands[Number(operandIndex)];

    if (operand === undefined) {
      return null;
    }

    return Encoder.encodeObject(Operand.Codec, operand, this.chainSpec);
  }

  allTransfers(): BytesBlob | null {
    return null;
  }

  oneTransfer(_transferIndex: U64): BytesBlob | null {
    return null;
  }
}
