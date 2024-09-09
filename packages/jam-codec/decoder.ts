import {BytesBlob} from "@typeberry/bytes";
import {check} from "@typeberry/utils";

// TODO [ToDr] Decode fixed-size sequence
// TODO [ToDr] Decode length-prefixed blob

export class Decoder {
  static fromBytesBlob(source: BytesBlob, offset?: number) {
    return new Decoder(source.buffer, offset);
  }

  static fromBlob(source: Uint8Array) {
    return new Decoder(source);
  }

  private readonly dataView: DataView;

  private constructor(
    private readonly source: Uint8Array,
    private offset: number = 0,
  ) {
    this.dataView = new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  bytesRead(): number {
    return this.offset;
  }

  private getNum(bytes: number, f: () => number) {
    this.ensureHasBytes(bytes);
    const num = f();
    this.offset += bytes;
    return num;
  }

  i8(): number {
    return this.getNum(1, () => this.dataView.getInt8(this.offset));
  }

  u8(): number {
    return this.getNum(1, () => this.dataView.getUint8(this.offset));
  }

  i16(): number {
    return this.getNum(2, () => this.dataView.getInt16(this.offset, true));
  }

  u16(): number {
    return this.getNum(2, () => this.dataView.getUint16(this.offset, true));
  }

  i24(): number {
    return this.getNum(3, () => {
      // TODO [ToDr] most likely broken
      let num = this.dataView.getInt8(this.offset);
      num += (this.dataView.getInt16(this.offset + 1, true)) << 8;
      return num;
    });
  }

  u24(): number {
    return this.getNum(3, () => {
      let num = this.dataView.getUint8(this.offset);
      num += (this.dataView.getUint16(this.offset + 1, true)) << 8;
      return num;
    });
  }

  i32(): number {
    return this.getNum(4, () => this.dataView.getInt32(this.offset, true));
  }

  u32(): number {
    return this.getNum(4, () => this.dataView.getUint32(this.offset, true));
  }

  bool(): boolean {
    const num = this.u8();
    if (num === 0) {
      return false;
    }

    if (num === 1) {
      return true;
    }

    throw new Error(`Unexpected number when decoding a boolean: ${num}`);
  }

  varU32(): number {
    const firstByte = this.source[this.offset];
    const l = decodeLengthAfterFirstByte(firstByte);
    this.offset += 1;

    if (l === 0) {
      return firstByte;
    }

    if (l >= 4) {
      throw new Error(`Unexpectedly large value for u32. l=${l}`);
    }

    let num = firstByte + 2 ** (8 - l) - 2 ** 8;
    if (l === 3) {
      num <<= 24;
      num += this.u24();
    } else if (l === 2) {
      num <<= 16;
      num += this.u16();
    } else {
      num <<= 8;
      num += this.u8();
    }
    return num;
  }

  moveTo(newOffset: number) {
    check(newOffset < this.source.length, `New offset goes beyond the source: ${newOffset} vs ${this.source.length}.`);
    this.offset = newOffset;
  }

  skip(bytes: number) {
    this.moveTo(this.offset + bytes);
  }

  private ensureHasBytes(bytes: number) {
    check(bytes >= 0, "Negative number of bytes given.");
    if (this.offset + bytes > this.source.length) {
      throw new Error(`Attempting to decode more data than there is left. Need ${bytes}, left: ${this.source.length - this.offset}.`);
    }
  }
}


const MASKS = [0xff, 0xfe, 0xfc, 0xf8, 0xf0, 0xe0, 0xc0, 0x80];
function decodeLengthAfterFirstByte(firstByte: number) {
  for (let i = 0; i < MASKS.length; i++) {
    if (firstByte >= MASKS[i]) {
      return 8 - i;
    }
  }

  return 0;
}
