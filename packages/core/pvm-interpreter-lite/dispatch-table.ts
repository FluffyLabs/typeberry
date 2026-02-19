import { Instruction } from "@typeberry/pvm-interpreter/instruction.js";
import {
  handleAnd,
  handleAndImm,
  handleAndInv,
  handleCountSetBits32,
  handleCountSetBits64,
  handleLeadingZeroBits32,
  handleLeadingZeroBits64,
  handleOr,
  handleOrImm,
  handleOrInv,
  handleReverseBytes,
  handleSignExtend8,
  handleSignExtend16,
  handleTrailingZeroBits32,
  handleTrailingZeroBits64,
  handleXnor,
  handleXor,
  handleXorImm,
  handleZeroExtend16,
} from "./handlers/bitwise.js";
import {
  handleBranchEq,
  handleBranchEqImm,
  handleBranchGeS,
  handleBranchGeSImm,
  handleBranchGeU,
  handleBranchGeUImm,
  handleBranchGtSImm,
  handleBranchGtUImm,
  handleBranchLeSImm,
  handleBranchLeUImm,
  handleBranchLtS,
  handleBranchLtSImm,
  handleBranchLtU,
  handleBranchLtUImm,
  handleBranchNe,
  handleBranchNeImm,
  handleJump,
  handleJumpInd,
  handleLoadImmJump,
  handleLoadImmJumpInd,
} from "./handlers/branch.js";
import {
  handleLoadI8,
  handleLoadI16,
  handleLoadI32,
  handleLoadImm,
  handleLoadImm64,
  handleLoadIndI8,
  handleLoadIndI16,
  handleLoadIndI32,
  handleLoadIndU8,
  handleLoadIndU16,
  handleLoadIndU32,
  handleLoadIndU64,
  handleLoadU8,
  handleLoadU16,
  handleLoadU32,
  handleLoadU64,
} from "./handlers/load.js";
import {
  handleAdd32,
  handleAdd64,
  handleAddImm32,
  handleAddImm64,
  handleDivS32,
  handleDivS64,
  handleDivU32,
  handleDivU64,
  handleMax,
  handleMaxU,
  handleMin,
  handleMinU,
  handleMul32,
  handleMul64,
  handleMulImm32,
  handleMulImm64,
  handleMulUpperSS,
  handleMulUpperSU,
  handleMulUpperUU,
  handleNegAddImm32,
  handleNegAddImm64,
  handleRemS32,
  handleRemS64,
  handleRemU32,
  handleRemU64,
  handleSub32,
  handleSub64,
} from "./handlers/math.js";
import { handleEcalli, handleFallthrough, handleSbrk, handleTrap } from "./handlers/misc.js";
import {
  handleCmovIz,
  handleCmovIzImm,
  handleCmovNz,
  handleCmovNzImm,
  handleMoveReg,
  handleSetGtSImm,
  handleSetGtUImm,
  handleSetLtS,
  handleSetLtSImm,
  handleSetLtU,
  handleSetLtUImm,
} from "./handlers/move.js";
import {
  handleRotL32,
  handleRotL64,
  handleRotR32,
  handleRotR32Imm,
  handleRotR32ImmAlt,
  handleRotR64,
  handleRotR64Imm,
  handleRotR64ImmAlt,
  handleSharR32,
  handleSharR64,
  handleSharRImm32,
  handleSharRImm64,
  handleSharRImmAlt32,
  handleSharRImmAlt64,
  handleShloL32,
  handleShloL64,
  handleShloLImm32,
  handleShloLImm64,
  handleShloLImmAlt32,
  handleShloLImmAlt64,
  handleShloR32,
  handleShloR64,
  handleShloRImm32,
  handleShloRImm64,
  handleShloRImmAlt32,
  handleShloRImmAlt64,
} from "./handlers/shift.js";
import {
  handleStoreImmIndU8,
  handleStoreImmIndU16,
  handleStoreImmIndU32,
  handleStoreImmIndU64,
  handleStoreImmU8,
  handleStoreImmU16,
  handleStoreImmU32,
  handleStoreImmU64,
  handleStoreIndU8,
  handleStoreIndU16,
  handleStoreIndU32,
  handleStoreIndU64,
  handleStoreU8,
  handleStoreU16,
  handleStoreU32,
  handleStoreU64,
} from "./handlers/store.js";
import type { InstructionHandler } from "./types.js";

/**
 * Build 256-element dispatch table mapping opcode byte -> handler function.
 * Unknown opcodes default to handleTrap (which returns EXIT_PANIC).
 */
export function buildDispatchTable(): InstructionHandler[] {
  const table = new Array<InstructionHandler>(256);
  table.fill(handleTrap);

  // No-args
  table[Instruction.TRAP] = handleTrap;
  table[Instruction.FALLTHROUGH] = handleFallthrough;

  // Host call (ONE_IMMEDIATE)
  table[Instruction.ECALLI] = handleEcalli;

  // Load immediate (ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE)
  table[Instruction.LOAD_IMM_64] = handleLoadImm64;

  // Store immediate to address (TWO_IMMEDIATES)
  table[Instruction.STORE_IMM_U8] = handleStoreImmU8;
  table[Instruction.STORE_IMM_U16] = handleStoreImmU16;
  table[Instruction.STORE_IMM_U32] = handleStoreImmU32;
  table[Instruction.STORE_IMM_U64] = handleStoreImmU64;

  // Jump (ONE_OFFSET)
  table[Instruction.JUMP] = handleJump;

  // ONE_REGISTER_ONE_IMMEDIATE
  table[Instruction.JUMP_IND] = handleJumpInd;
  table[Instruction.LOAD_IMM] = handleLoadImm;
  table[Instruction.LOAD_U8] = handleLoadU8;
  table[Instruction.LOAD_I8] = handleLoadI8;
  table[Instruction.LOAD_U16] = handleLoadU16;
  table[Instruction.LOAD_I16] = handleLoadI16;
  table[Instruction.LOAD_U32] = handleLoadU32;
  table[Instruction.LOAD_I32] = handleLoadI32;
  table[Instruction.LOAD_U64] = handleLoadU64;
  table[Instruction.STORE_U8] = handleStoreU8;
  table[Instruction.STORE_U16] = handleStoreU16;
  table[Instruction.STORE_U32] = handleStoreU32;
  table[Instruction.STORE_U64] = handleStoreU64;

  // Store immediate indirect (ONE_REGISTER_TWO_IMMEDIATES)
  table[Instruction.STORE_IMM_IND_U8] = handleStoreImmIndU8;
  table[Instruction.STORE_IMM_IND_U16] = handleStoreImmIndU16;
  table[Instruction.STORE_IMM_IND_U32] = handleStoreImmIndU32;
  table[Instruction.STORE_IMM_IND_U64] = handleStoreImmIndU64;

  // Branch with immediate (ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET)
  table[Instruction.LOAD_IMM_JUMP] = handleLoadImmJump;
  table[Instruction.BRANCH_EQ_IMM] = handleBranchEqImm;
  table[Instruction.BRANCH_NE_IMM] = handleBranchNeImm;
  table[Instruction.BRANCH_LT_U_IMM] = handleBranchLtUImm;
  table[Instruction.BRANCH_LE_U_IMM] = handleBranchLeUImm;
  table[Instruction.BRANCH_GE_U_IMM] = handleBranchGeUImm;
  table[Instruction.BRANCH_GT_U_IMM] = handleBranchGtUImm;
  table[Instruction.BRANCH_LT_S_IMM] = handleBranchLtSImm;
  table[Instruction.BRANCH_LE_S_IMM] = handleBranchLeSImm;
  table[Instruction.BRANCH_GE_S_IMM] = handleBranchGeSImm;
  table[Instruction.BRANCH_GT_S_IMM] = handleBranchGtSImm;

  // TWO_REGISTERS
  table[Instruction.MOVE_REG] = handleMoveReg;
  table[Instruction.SBRK] = handleSbrk;
  table[Instruction.COUNT_SET_BITS_64] = handleCountSetBits64;
  table[Instruction.COUNT_SET_BITS_32] = handleCountSetBits32;
  table[Instruction.LEADING_ZERO_BITS_64] = handleLeadingZeroBits64;
  table[Instruction.LEADING_ZERO_BITS_32] = handleLeadingZeroBits32;
  table[Instruction.TRAILING_ZERO_BITS_64] = handleTrailingZeroBits64;
  table[Instruction.TRAILING_ZERO_BITS_32] = handleTrailingZeroBits32;
  table[Instruction.SIGN_EXTEND_8] = handleSignExtend8;
  table[Instruction.SIGN_EXTEND_16] = handleSignExtend16;
  table[Instruction.ZERO_EXTEND_16] = handleZeroExtend16;
  table[Instruction.REVERSE_BYTES] = handleReverseBytes;

  // TWO_REGISTERS_ONE_IMMEDIATE
  table[Instruction.STORE_IND_U8] = handleStoreIndU8;
  table[Instruction.STORE_IND_U16] = handleStoreIndU16;
  table[Instruction.STORE_IND_U32] = handleStoreIndU32;
  table[Instruction.STORE_IND_U64] = handleStoreIndU64;
  table[Instruction.LOAD_IND_U8] = handleLoadIndU8;
  table[Instruction.LOAD_IND_I8] = handleLoadIndI8;
  table[Instruction.LOAD_IND_U16] = handleLoadIndU16;
  table[Instruction.LOAD_IND_I16] = handleLoadIndI16;
  table[Instruction.LOAD_IND_U32] = handleLoadIndU32;
  table[Instruction.LOAD_IND_I32] = handleLoadIndI32;
  table[Instruction.LOAD_IND_U64] = handleLoadIndU64;
  table[Instruction.ADD_IMM_32] = handleAddImm32;
  table[Instruction.ADD_IMM_64] = handleAddImm64;
  table[Instruction.AND_IMM] = handleAndImm;
  table[Instruction.XOR_IMM] = handleXorImm;
  table[Instruction.OR_IMM] = handleOrImm;
  table[Instruction.MUL_IMM_32] = handleMulImm32;
  table[Instruction.MUL_IMM_64] = handleMulImm64;
  table[Instruction.SET_LT_U_IMM] = handleSetLtUImm;
  table[Instruction.SET_LT_S_IMM] = handleSetLtSImm;
  table[Instruction.SHLO_L_IMM_32] = handleShloLImm32;
  table[Instruction.SHLO_R_IMM_32] = handleShloRImm32;
  table[Instruction.SHAR_R_IMM_32] = handleSharRImm32;
  table[Instruction.NEG_ADD_IMM_32] = handleNegAddImm32;
  table[Instruction.NEG_ADD_IMM_64] = handleNegAddImm64;
  table[Instruction.SET_GT_U_IMM] = handleSetGtUImm;
  table[Instruction.SET_GT_S_IMM] = handleSetGtSImm;
  table[Instruction.SHLO_L_IMM_ALT_32] = handleShloLImmAlt32;
  table[Instruction.SHLO_R_IMM_ALT_32] = handleShloRImmAlt32;
  table[Instruction.SHAR_R_IMM_ALT_32] = handleSharRImmAlt32;
  table[Instruction.SHLO_L_IMM_64] = handleShloLImm64;
  table[Instruction.SHLO_R_IMM_64] = handleShloRImm64;
  table[Instruction.SHAR_R_IMM_64] = handleSharRImm64;
  table[Instruction.SHLO_L_IMM_ALT_64] = handleShloLImmAlt64;
  table[Instruction.SHLO_R_IMM_ALT_64] = handleShloRImmAlt64;
  table[Instruction.SHAR_R_IMM_ALT_64] = handleSharRImmAlt64;
  table[Instruction.CMOV_IZ_IMM] = handleCmovIzImm;
  table[Instruction.CMOV_NZ_IMM] = handleCmovNzImm;
  table[Instruction.ROT_R_64_IMM] = handleRotR64Imm;
  table[Instruction.ROT_R_64_IMM_ALT] = handleRotR64ImmAlt;
  table[Instruction.ROT_R_32_IMM] = handleRotR32Imm;
  table[Instruction.ROT_R_32_IMM_ALT] = handleRotR32ImmAlt;

  // Branch register-register (TWO_REGISTERS_ONE_OFFSET)
  table[Instruction.BRANCH_EQ] = handleBranchEq;
  table[Instruction.BRANCH_NE] = handleBranchNe;
  table[Instruction.BRANCH_LT_U] = handleBranchLtU;
  table[Instruction.BRANCH_LT_S] = handleBranchLtS;
  table[Instruction.BRANCH_GE_U] = handleBranchGeU;
  table[Instruction.BRANCH_GE_S] = handleBranchGeS;

  // LOAD_IMM_JUMP_IND (TWO_REGISTERS_TWO_IMMEDIATES)
  table[Instruction.LOAD_IMM_JUMP_IND] = handleLoadImmJumpInd;

  // THREE_REGISTERS
  table[Instruction.ADD_32] = handleAdd32;
  table[Instruction.ADD_64] = handleAdd64;
  table[Instruction.SUB_32] = handleSub32;
  table[Instruction.SUB_64] = handleSub64;
  table[Instruction.MUL_32] = handleMul32;
  table[Instruction.MUL_64] = handleMul64;
  table[Instruction.MUL_UPPER_U_U] = handleMulUpperUU;
  table[Instruction.MUL_UPPER_S_S] = handleMulUpperSS;
  table[Instruction.MUL_UPPER_S_U] = handleMulUpperSU;
  table[Instruction.DIV_U_32] = handleDivU32;
  table[Instruction.DIV_S_32] = handleDivS32;
  table[Instruction.REM_U_32] = handleRemU32;
  table[Instruction.REM_S_32] = handleRemS32;
  table[Instruction.DIV_U_64] = handleDivU64;
  table[Instruction.DIV_S_64] = handleDivS64;
  table[Instruction.REM_U_64] = handleRemU64;
  table[Instruction.REM_S_64] = handleRemS64;
  table[Instruction.SHLO_L_32] = handleShloL32;
  table[Instruction.SHLO_R_32] = handleShloR32;
  table[Instruction.SHAR_R_32] = handleSharR32;
  table[Instruction.SHLO_L_64] = handleShloL64;
  table[Instruction.SHLO_R_64] = handleShloR64;
  table[Instruction.SHAR_R_64] = handleSharR64;
  table[Instruction.AND] = handleAnd;
  table[Instruction.XOR] = handleXor;
  table[Instruction.OR] = handleOr;
  table[Instruction.AND_INV] = handleAndInv;
  table[Instruction.OR_INV] = handleOrInv;
  table[Instruction.XNOR] = handleXnor;
  table[Instruction.SET_LT_U] = handleSetLtU;
  table[Instruction.SET_LT_S] = handleSetLtS;
  table[Instruction.CMOV_IZ] = handleCmovIz;
  table[Instruction.CMOV_NZ] = handleCmovNz;
  table[Instruction.ROT_L_64] = handleRotL64;
  table[Instruction.ROT_L_32] = handleRotL32;
  table[Instruction.ROT_R_64] = handleRotR64;
  table[Instruction.ROT_R_32] = handleRotR32;
  table[Instruction.MAX] = handleMax;
  table[Instruction.MAX_U] = handleMaxU;
  table[Instruction.MIN] = handleMin;
  table[Instruction.MIN_U] = handleMinU;

  return table;
}
