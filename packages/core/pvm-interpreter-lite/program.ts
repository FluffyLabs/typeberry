import { Instruction } from "@typeberry/pvm-interpreter/instruction.js";
import { ProgramDecoder } from "@typeberry/pvm-interpreter/program-decoder/program-decoder.js";

// Termination instructions - used to determine basic block boundaries
const terminationOpcodes = new Set<number>([
  Instruction.TRAP,
  Instruction.FALLTHROUGH,
  Instruction.JUMP,
  Instruction.JUMP_IND,
  Instruction.LOAD_IMM_JUMP,
  Instruction.LOAD_IMM_JUMP_IND,
  Instruction.BRANCH_EQ,
  Instruction.BRANCH_NE,
  Instruction.BRANCH_GE_U,
  Instruction.BRANCH_GE_S,
  Instruction.BRANCH_LT_U,
  Instruction.BRANCH_LT_S,
  Instruction.BRANCH_EQ_IMM,
  Instruction.BRANCH_NE_IMM,
  Instruction.BRANCH_LT_U_IMM,
  Instruction.BRANCH_LT_S_IMM,
  Instruction.BRANCH_LE_U_IMM,
  Instruction.BRANCH_LE_S_IMM,
  Instruction.BRANCH_GE_U_IMM,
  Instruction.BRANCH_GE_S_IMM,
  Instruction.BRANCH_GT_U_IMM,
  Instruction.BRANCH_GT_S_IMM,
]);

/**
 * Decoded program blob containing code, skip table, basic blocks, and jump table.
 *
 * Reuses ProgramDecoder from pvm-interpreter for raw decoding,
 * but produces optimized data structures:
 * - skip[] as Uint8Array (same as Mask.lookupTableForward)
 * - blocks[] as Uint8Array instead of Set<number>
 * - jumpTable as Uint32Array
 */
export class Program {
  readonly code: Uint8Array;
  readonly skip: Uint8Array;
  readonly blocks: Uint8Array;
  readonly jumpTable: Uint32Array;
  readonly jumpTableSize: number;

  constructor(rawProgram: Uint8Array) {
    const decoder = new ProgramDecoder(rawProgram);
    this.code = decoder.getCode();

    const mask = decoder.getMask();
    const codeLen = this.code.length;

    // Build skip table from mask
    // skip[i] = number of bytes from position i to the next instruction start
    this.skip = new Uint8Array(codeLen);
    {
      let lastInstructionOffset = 0;
      for (let i = codeLen - 1; i >= 0; i--) {
        if (mask.isInstruction(i)) {
          lastInstructionOffset = 0;
        } else {
          lastInstructionOffset++;
        }
        this.skip[i] = Math.min(lastInstructionOffset, 25);
      }
    }

    // Build basic blocks as Uint8Array (1 = block start, 0 = not)
    this.blocks = new Uint8Array(codeLen + 1); // +1 for pc just past end
    this.blocks[0] = 1;
    for (let i = 0; i < codeLen; i++) {
      if (mask.isInstruction(i) && terminationOpcodes.has(this.code[i])) {
        const nextPc = i + 1 + this.skip[i + 1];
        if (nextPc <= codeLen) {
          this.blocks[nextPc] = 1;
        }
      }
    }

    // Copy jump table
    const jt = decoder.getJumpTable();
    const jtSize = jt.getSize();
    this.jumpTableSize = jtSize;
    this.jumpTable = new Uint32Array(jtSize);
    for (let i = 0; i < jtSize; i++) {
      this.jumpTable[i] = jt.getDestination(i);
    }
  }
}
