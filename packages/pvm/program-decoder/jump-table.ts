import { decodeNaturalNumber } from "@typeberry/jam-codec";
import { check } from "@typeberry/utils";

export class JumpTable {
  private indexes = new Set<number>();

  constructor(jumpTableItemLength: number, bytes: Uint8Array) {
    check(
      bytes.length % jumpTableItemLength === 0,
      `Length of jump table (${bytes.length}) should be a multiple of item lenght (${jumpTableItemLength})!`,
    );

    for (let i = 0; i < bytes.length; i += jumpTableItemLength) {
      const index = this.decodeItem(bytes.subarray(i, i + jumpTableItemLength));
      this.indexes.add(index);
    }
  }

  private decodeItem(bytes: Uint8Array) {
    const { value } = decodeNaturalNumber(bytes);
    return Number(value);
  }

  hasIndex(index: number) {
    return this.indexes.has(index);
  }
}
