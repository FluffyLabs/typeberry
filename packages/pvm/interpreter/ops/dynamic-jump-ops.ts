import type { BasicBlocks } from "../basic-blocks";
import type { InstructionResult } from "../instruction-result";
import type { JumpTable } from "../program-decoder/jump-table";
import type { Registers } from "../registers";
import { Result } from "../result";
import { addWithOverflow } from "./math-utils";

const EXIT = 0xff_ff_00_00;
/** `Z_A`: https://graypaper.fluffylabs.dev/#/911af30/24ed0124ee01 */
const JUMP_ALIGMENT_FACTOR = 2;

export class DynamicJumpOps {
  constructor(
    private regs: Registers,
    private jumpTable: JumpTable,
    private instructionResult: InstructionResult,
    private basicBlocks: BasicBlocks,
  ) {}

  private djump(dynamicAddress: number) {
    if (dynamicAddress === EXIT) {
      this.instructionResult.status = Result.HALT;
      return;
    }

    if (dynamicAddress === 0 || dynamicAddress % JUMP_ALIGMENT_FACTOR !== 0) {
      this.instructionResult.status = Result.PANIC;
      return;
    }

    const jumpTableIndex = dynamicAddress / JUMP_ALIGMENT_FACTOR - 1;
    const destination = this.jumpTable.getDestination(jumpTableIndex);

    if (!this.jumpTable.hasIndex(jumpTableIndex) || !this.basicBlocks.isBeginningOfBasicBlock(jumpTableIndex)) {
      this.instructionResult.status = Result.PANIC;
      return;
    }

    this.instructionResult.nextPc = destination;
  }

  jumpInd(immediateValue: number, registerIndex: number) {
    const registerValue = this.regs.getU32(registerIndex);
    const address = addWithOverflow(registerValue, immediateValue);
    this.djump(address);
  }
}
