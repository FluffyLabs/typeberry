import { Decoder } from "@typeberry/codec";
import { check } from "@typeberry/utils";

export class JumpTable {
  private indices: Uint32Array;

  constructor(itemByteLength: number, bytes: Uint8Array) {
    check(
      itemByteLength === 0 || bytes.length % itemByteLength === 0,
      `Length of jump table (${bytes.length}) should be a multiple of item lenght (${itemByteLength})!`,
    );
    check(itemByteLength <= 4, "Programs larger than 2**32 are not supported");

    const length = itemByteLength === 0 ? 0 : bytes.length / itemByteLength;

    this.indices = new Uint32Array(length);
    const decoder = Decoder.fromBlob(bytes);
    let decodeNext = () => decoder.u8();
    if (itemByteLength === 4) {
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
}
