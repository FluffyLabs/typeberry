import { Decoder } from "@typeberry/jam-codec";
import { JumpTable } from "./jump-table";
import { Mask } from "./mask";

export class ProgramDecoder {
  private code: Uint8Array;
  private mask: Mask;
  private jumpTable: JumpTable;

  constructor(rawProgram: Uint8Array) {
    const { code, mask, jumpTable, jumpTableIndexByteLen } = this.decodeProgram(rawProgram);

    this.code = new Uint8Array(code);
    this.mask = new Mask(mask);
    this.jumpTable = new JumpTable(jumpTableIndexByteLen, jumpTable);
  }

  private decodeProgram(program: Uint8Array) {
    const decoder = Decoder.fromBlob(program);
    const jumpTableLength = decoder.varU32();
    const jumpTableIndexByteLen = decoder.i8();
    const codeLength = decoder.varU32();

    // TODO [ToDr] we could decode a bitvec here, but currently
    // the test programs have remaining bits filled with `1`s,
    // which is not aligned with the codec expectations (`0` padded).
    const jumpTableLengthInBytes = jumpTableLength * jumpTableIndexByteLen;
    const jumpTable = decoder.bytes(jumpTableLengthInBytes).raw;

    const code = decoder.bytes(codeLength).raw;
    const maskLengthInBytes = Math.ceil(codeLength / 8);
    const mask = decoder.bytes(maskLengthInBytes).raw;

    return {
      mask,
      code,
      jumpTableIndexByteLen,
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
