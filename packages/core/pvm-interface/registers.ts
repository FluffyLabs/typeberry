export const NO_OF_REGISTERS = 13;
export const REGISTER_BYTE_SIZE = 8;

/** Allow to set and get all registers encoded into little-endian bytes. */
export interface IRegisters {
  /**
   * Get all registers encoded into little-endian bytes.
   *
   * NOTE: Total length of bytes must be NO_OF_REGISTERS * REGISTER_BYTE_SIZE.
   */
  getAllEncoded(): Uint8Array;
  /**
   * Set all registers from little-endian encoded bytes.
   *
   * NOTE: Total length of bytes must be NO_OF_REGISTERS * REGISTER_BYTE_SIZE.
   */
  setAllEncoded(bytes: Uint8Array): void;
}
