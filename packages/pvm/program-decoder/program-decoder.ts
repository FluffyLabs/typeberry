import {Decoder} from "@typeberry/jam-codec";
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

    // TODO [ToDr] this could be `decodeBytes(len)`
    const jumpTableFirstByteIndex = decoder.bytesRead();
    const jumpTableLengthInBytes = jumpTableLength * jumpTableIndexByteLen;
    const jumpTable = program.subarray(jumpTableFirstByteIndex, jumpTableFirstByteIndex + jumpTableLengthInBytes);

    const codeFirstIndex = jumpTableFirstByteIndex + jumpTableLengthInBytes;
    const code = program.subarray(codeFirstIndex, codeFirstIndex + codeLength);
    const maskFirstIndex = codeFirstIndex + Number(codeLength);
    const maskLengthInBytes = Math.ceil(Number(codeLength) / 8);
    const mask = program.subarray(maskFirstIndex, maskFirstIndex + maskLengthInBytes);

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
