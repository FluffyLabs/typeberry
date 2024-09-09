import {BytesBlob} from "@typeberry/bytes";
import {check} from "@typeberry/utils";

export class Decoder {
  static fromBytesBlob(source: BytesBlob, offset?: number) {
    return new Decoder(source.buffer, offset);
  }

  static fromBlob(source: Uint8Array) {
    return new Decoder(source);
  }

  private constructor(
    private readonly source: Uint8Array,
    private offset: number = 0,
  ) {}

  i8(): number {
    return this.iN(1);
  }

  i16(): number {
    return this.iN(2);
  }

  i24(): number {
    return this.iN(3);
  }

  i32(): number {
    return this.iN(4);
  }

  private iN(bytes: 1 | 2 | 3 | 4): number {
    this.ensureHasBytes(bytes);
    let num = 0;
    for (let i = this.offset; i < this.offset + bytes; i += 1) {
      num <<= 8;
      num += this.source[i];
    }
    // TODO [ToDr] handle negative numbers.
    return num;
  }

  private ensureHasBytes(bytes: number) {
    check(bytes >= 0, "Negative number of bytes given.");
    if (this.offset + bytes > this.source.length) {
      throw new Error(`Attempting to decode more data than there is left. Need ${bytes}, left: ${this.source.length - this.offset}.`);
    }
  }
}
