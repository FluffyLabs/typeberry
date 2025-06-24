// GP reference: https://graypaper.fluffylabs.dev/#/579bd12/2ba8022ba802

export const PAGE_SIZE = 2 ** 12; // Z_P from GP
export const SEGMENT_SIZE = 2 ** 16; // Z_Z from GP
export const DATA_LEGNTH = 2 ** 24; // Z_I from GP
export const STACK_SEGMENT = 0xfe_fe_00_00; // 2^32 - 2Z_Z - Z_I from GP
export const ARGS_SEGMENT = 0xfe_ff_00_00; // 2^32 - Z_Z - Z_I from GP
export const LAST_PAGE = 0xff_ff_00_00;
