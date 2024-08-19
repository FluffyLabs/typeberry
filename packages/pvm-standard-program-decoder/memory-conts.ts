// GP references: https://graypaper.fluffylabs.dev/#WyIxYjA4MWZlM2U3IiwiMjciLG51bGwsbnVsbCxbIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoNiB5MTU0MSBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiIsIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoNiB5MTU0MSBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==

export const PAGE_SIZE = 2 ** 14; // Z_P from GP
export const SEGMENT_SIZE = 2 ** 16; // Z_Q from GP
export const DATA_LEGNTH = 2 ** 24; // Z_I from GP
export const STACK_SEGMENT = 0xfe_fe_00_00; // 2^32 - 2Z_Q - Z_I from GP
export const ARGS_SEGMENT = 0xfe_ff_00_00; // 2^32 - Z_Q - Z_I from GP
export const LAST_PAGE = 0xff_ff_00_00;
