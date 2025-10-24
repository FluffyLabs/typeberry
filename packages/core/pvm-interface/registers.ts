export const NO_OF_REGISTERS = 13;
export const REGISTER_BYTE_SIZE = 8;

export interface IRegisters {
  /** Get all registers encoded into little-endian bytes. */
  getAllEncoded(): Uint8Array;
  /** Set all registers from little-endian encoded bytes. */
  setAllFromBytes(bytes: Uint8Array): void;
}
