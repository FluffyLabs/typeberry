export const SEGMENT_SIZE = 2 ** 16; // Z_Q from GP
export const PAGE_SIZE = 2 ** 14; // Z_P from GP
export const STACK_SEGMENT = 0xfe_fe_00_00; // 2^32 - 2Z_Q - Z_I from GP
export const ZERO = new Uint8Array([0, 0, 0, 0]);
