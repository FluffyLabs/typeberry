import { Decoder } from "@typeberry/codec";
import { Instruction } from "@typeberry/pvm-interpreter/instruction.js";

const MAX_INSTRUCTION_DISTANCE = 25;

const MAX_OPCODE = 256;
const terminationOpcodes = new Uint8Array(MAX_OPCODE);
terminationOpcodes[Instruction.TRAP] = 1;
terminationOpcodes[Instruction.FALLTHROUGH] = 1;
terminationOpcodes[Instruction.JUMP] = 1;
terminationOpcodes[Instruction.JUMP_IND] = 1;
terminationOpcodes[Instruction.LOAD_IMM_JUMP] = 1;
terminationOpcodes[Instruction.LOAD_IMM_JUMP_IND] = 1;
terminationOpcodes[Instruction.BRANCH_EQ] = 1;
terminationOpcodes[Instruction.BRANCH_NE] = 1;
terminationOpcodes[Instruction.BRANCH_GE_U] = 1;
terminationOpcodes[Instruction.BRANCH_GE_S] = 1;
terminationOpcodes[Instruction.BRANCH_LT_U] = 1;
terminationOpcodes[Instruction.BRANCH_LT_S] = 1;
terminationOpcodes[Instruction.BRANCH_EQ_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_NE_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_LT_U_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_LT_S_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_LE_U_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_LE_S_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_GE_U_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_GE_S_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_GT_U_IMM] = 1;
terminationOpcodes[Instruction.BRANCH_GT_S_IMM] = 1;

/**
 * Reusable buffers for decodeProgram. Keeps pre-allocated arrays that only grow.
 * Pass the same instance to decodeProgram on every resetGeneric call to avoid
 * allocating new Uint8Array/Uint32Array every time.
 */
export class DecodeBufs {
  skip: Uint8Array = new Uint8Array(0);
  blocks: Uint8Array = new Uint8Array(0);
  jumpTable: Uint32Array = new Uint32Array(0);

  /** Ensure skip buffer is at least `len` bytes. Only grows, never shrinks. */
  ensureSkip(len: number): Uint8Array {
    if (this.skip.length < len) {
      this.skip = new Uint8Array(len);
    }
    return this.skip;
  }

  /** Ensure blocks buffer is at least `len` bytes. Only grows, never shrinks. */
  ensureBlocks(len: number): Uint8Array {
    if (this.blocks.length < len) {
      this.blocks = new Uint8Array(len);
    }
    return this.blocks;
  }

  /** Ensure jumpTable buffer is at least `len` elements. Only grows, never shrinks. */
  ensureJumpTable(len: number): Uint32Array {
    if (this.jumpTable.length < len) {
      this.jumpTable = new Uint32Array(len);
    }
    return this.jumpTable;
  }
}

export function decodeProgram(rawProgram: Uint8Array, bufs?: DecodeBufs) {
  const decoder = Decoder.fromBlob(rawProgram);

  const jumpTableLength = decoder.varU32();
  const jumpTableItemLength = decoder.u8();
  const codeLength = decoder.varU32();

  const jumpTableLengthInBytes = jumpTableLength * jumpTableItemLength;
  const jumpTableData = decoder.bytes(jumpTableLengthInBytes).raw;

  const code = decoder.bytes(codeLength).raw;
  const maskBits = decoder.bitVecFixLen(codeLength);
  decoder.finish();

  const codeLen = code.length;

  // Reuse or allocate skip table
  const skip = bufs ? bufs.ensureSkip(codeLen) : new Uint8Array(codeLen);
  let lastInstructionOffset = 0;
  for (let i = codeLen - 1; i >= 0; i--) {
    if (maskBits.isSet(i)) {
      lastInstructionOffset = 0;
    } else {
      lastInstructionOffset++;
    }
    skip[i] = Math.min(lastInstructionOffset, MAX_INSTRUCTION_DISTANCE);
  }

  // Reuse or allocate blocks table
  const blocksLen = codeLen + 1;
  const blocks = bufs ? bufs.ensureBlocks(blocksLen) : new Uint8Array(blocksLen);
  // Must zero-fill the used portion (reusable buffer may have stale data)
  if (bufs) {
    blocks.fill(0, 0, blocksLen);
  }
  blocks[0] = 1;
  for (let i = 0; i < codeLen; i++) {
    if (maskBits.isSet(i) && terminationOpcodes[code[i]]) {
      const nextPc = i + 1 + skip[i + 1];
      if (nextPc <= codeLen) {
        blocks[nextPc] = 1;
      }
    }
  }

  // Reuse or allocate jump table
  const jumpTable = bufs ? bufs.ensureJumpTable(jumpTableLength) : new Uint32Array(jumpTableLength);
  for (let i = 0; i < jumpTableLength; i++) {
    let dest = 0;
    for (let j = 0; j < jumpTableItemLength; j++) {
      dest |= jumpTableData[i * jumpTableItemLength + j] << (j * 8);
    }
    jumpTable[i] = dest;
  }

  return {
    code,
    skip,
    blocks,
    jumpTable,
    jumpTableSize: jumpTableLength,
  };
}
