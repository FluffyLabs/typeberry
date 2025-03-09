import { Decoder } from "@typeberry/codec";
import { JumpTable } from "./jump-table";
import { Mask } from "./mask";

export class ProgramDecoder {
  private code: Uint8Array;
  private mask: Mask;
  private jumpTable: JumpTable;

  constructor(rawProgram: Uint8Array) {
    const { code, mask, jumpTable, jumpTableItemLength } = this.decodeProgram(rawProgram);

    this.code = new Uint8Array(code);
    this.mask = new Mask(mask);
    this.jumpTable = new JumpTable(jumpTableItemLength, jumpTable);
  }

  private decodeProgram(program: Uint8Array) {
    const decoder = Decoder.fromBlob(program);
    // number of items in the jump table
    const jumpTableLength = decoder.varU32();
    // how many bytes are used to encode a single item of the jump table
    const jumpTableItemLength = decoder.u8();
    // the length of the code (in bytes).
    const codeLength = decoder.varU32();

    const jumpTableLengthInBytes = jumpTableLength * jumpTableItemLength;
    const jumpTable = decoder.bytes(jumpTableLengthInBytes).raw;

    const code = decoder.bytes(codeLength).raw;
    const mask = decoder.bitVecFixLen(codeLength);
    decoder.finish();

    return {
      mask,
      code,
      jumpTableItemLength,
      jumpTable,
    };
  }

  getMask() {
    return this.mask;
  }

  getCode() {
    return this.code;
  }

  getJumpTable() {
    return this.jumpTable;
  }
}
