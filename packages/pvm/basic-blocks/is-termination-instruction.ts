import { HIGHEST_INSTRUCTION_NUMBER, Instruction } from "../instruction";

export const terminationInstructions = new Array<boolean>(HIGHEST_INSTRUCTION_NUMBER + 1);

terminationInstructions.fill(false);

terminationInstructions[Instruction.TRAP] = true;
terminationInstructions[Instruction.FALLTHROUGH] = true;
terminationInstructions[Instruction.JUMP] = true;
terminationInstructions[Instruction.JUMP_IND] = true;
terminationInstructions[Instruction.LOAD_IMM_JUMP] = true;
terminationInstructions[Instruction.BRANCH_EQ_IMM] = true;
terminationInstructions[Instruction.BRANCH_NE_IMM] = true;
terminationInstructions[Instruction.BRANCH_LT_U_IMM] = true;
terminationInstructions[Instruction.BRANCH_LE_U_IMM] = true;
terminationInstructions[Instruction.BRANCH_GE_U_IMM] = true;
terminationInstructions[Instruction.BRANCH_GT_U_IMM] = true;
terminationInstructions[Instruction.BRANCH_LT_S_IMM] = true;
terminationInstructions[Instruction.BRANCH_LE_S_IMM] = true;
terminationInstructions[Instruction.BRANCH_GE_S_IMM] = true;
terminationInstructions[Instruction.BRANCH_GT_S_IMM] = true;
terminationInstructions[Instruction.BRANCH_EQ] = true;
terminationInstructions[Instruction.BRANCH_NE] = true;
terminationInstructions[Instruction.BRANCH_LT_U] = true;
terminationInstructions[Instruction.BRANCH_LT_S] = true;
terminationInstructions[Instruction.BRANCH_GE_U] = true;
terminationInstructions[Instruction.BRANCH_GE_S] = true;
terminationInstructions[Instruction.LOAD_IMM_JUMP_IND] = true;
