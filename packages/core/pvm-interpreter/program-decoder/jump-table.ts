import { Decoder } from "@typeberry/codec";
import { check } from "@typeberry/utils";

export class JumpTable {
  private indices: Uint32Array;

  constructor(itemByteLength: number, bytes: Uint8Array) {
    check(
      itemByteLength === 0 || bytes.length % itemByteLength === 0,
      `Length of jump table (${bytes.length}) should be a multiple of item lenght (${itemByteLength})!`,
    );
    check(
      itemByteLength <= 4 || itemByteLength === 8,
      `Jump table item can be u8, u16, u24, u32 or u64. Got: u${itemByteLength * 8}}`,
    );

    const length = itemByteLength === 0 ? 0 : bytes.length / itemByteLength;

    this.indices = new Uint32Array(length);
    const decoder = Decoder.fromBlob(bytes);
    let decodeNext = () => decoder.u8() as number;
    if (itemByteLength === 8) {
      /**
       * GP defines jump table indices as u64 values, so it's possible to encounter
       * programs with large jump targets. While jumps beyond 2 ** 32 (4GB) don't make
       * practical sense—since programs can't be that large—they are still considered
       * valid, and we must be able to load them.
       */
      decodeNext = () => {
        const lowerPart = decoder.u32();
        const higherPart = decoder.u32();

        /**
         * jump to an index that is bigger than 2 ** 32 will cause panic
         * so the destination does not matter and we can clamp it
         */
        if (higherPart === 0) {
          return Number(lowerPart);
        }

        /**
         * Jumping to an index >= 2 ** 32 would cause a panic
         * so we can safely clamp it to 2 ** 32 - 1
         */
        return 2 ** 32 - 1;
      };
    } else if (itemByteLength === 4) {
      decodeNext = () => decoder.u32();
    } else if (itemByteLength === 3) {
      decodeNext = () => decoder.u24();
    } else if (itemByteLength === 2) {
      decodeNext = () => decoder.u16();
    }
    for (let i = 0; i < length; i += 1) {
      this.indices[i] = decodeNext();
    }
    decoder.finish();
  }

  hasIndex(index: number) {
    return index < this.indices.length && index >= 0;
  }

  getDestination(index: number) {
    return this.indices[index];
  }

  static empty() {
    return new JumpTable(0, new Uint8Array());
  }

  copyFrom(jt: JumpTable) {
    this.indices = jt.indices;
  }
}
