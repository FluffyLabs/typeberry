import type { EntropyHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { general, type PendingTransfer } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import type { Operand } from "../accumulate/operand.js";
import {
  getEncodedConstants,
  TRANSFER_OR_OPERAND,
  TRANSFERS_AND_OPERANDS,
  TransferOperandKind,
  type TransferOrOperand,
} from "./fetch-externalities.js";

export class AccumulateFetchExternalities implements general.IAccumulateFetch {
  readonly context = general.FetchContext.Accumulate;

  constructor(
    private readonly entropy_: EntropyHash,
    private readonly transfers: PendingTransfer[],
    private readonly operands: Operand[],
    private readonly chainSpec: ChainSpec,
  ) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  entropy(): BytesBlob {
    return this.entropy_.asOpaque();
  }

  allTransfersAndOperands(): BytesBlob | null {
    const transfersAndOperands: TransferOrOperand[] = this.transfers
      .map((transfer): TransferOrOperand => ({ kind: TransferOperandKind.TRANSFER, value: transfer }))
      .concat(
        this.operands.map((operand): TransferOrOperand => ({ kind: TransferOperandKind.OPERAND, value: operand })),
      );

    return Encoder.encodeObject(TRANSFERS_AND_OPERANDS, transfersAndOperands, this.chainSpec);
  }

  oneTransferOrOperand(index: U64): BytesBlob | null {
    if (index >= this.operands.length + this.transfers.length) {
      return null;
    }

    const kind = index < this.operands.length ? TransferOperandKind.OPERAND : TransferOperandKind.TRANSFER;
    const transferOrOperand =
      kind === TransferOperandKind.OPERAND
        ? ({ kind: TransferOperandKind.OPERAND, value: this.operands[Number(index)] } as const)
        : ({
            kind: TransferOperandKind.TRANSFER,
            value: this.transfers[Number(index) - this.operands.length],
          } as const);

    if (transferOrOperand.value === undefined) {
      return null;
    }

    return Encoder.encodeObject(TRANSFER_OR_OPERAND, transferOrOperand, this.chainSpec);
  }
}
