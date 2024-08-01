import type { InstructionResult } from "../instruction-result";
import type { JumpTable } from "../program-decoder/jump-table";
import type { Mask } from "../program-decoder/mask";
import type { Registers } from "../registers";
import { Result } from "../result";
import { MAX_VALUE } from "./math-consts";

const EXIT = 0xff_ff_00_00;
const JUMP_ALIGMENT_FACTOR = 4;

export class DynamicJumpOps {
  constructor(
    private regs: Registers,
    private jumpTable: JumpTable,
    private instructionResult: InstructionResult,
    private mask: Mask,
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

    if (!this.jumpTable.hasIndex(jumpTableIndex) || !this.mask.isInstruction(destination)) {
      this.instructionResult.status = Result.PANIC;
      return;
    }

    this.instructionResult.pcOffset = destination;
  }

  jumpInd(immediateValue: number, registerIndex: number) {
    if (this.regs.asUnsigned[registerIndex] > MAX_VALUE - immediateValue) {
      const dynamicAddress =
        MAX_VALUE -
        Math.max(this.regs.asUnsigned[registerIndex], immediateValue) +
        Math.min(this.regs.asUnsigned[registerIndex], immediateValue) -
        1;
      this.djump(dynamicAddress);
    } else {
      const dynamicAddress = this.regs.asUnsigned[registerIndex] + immediateValue;
      this.djump(dynamicAddress);
    }
  }
}
