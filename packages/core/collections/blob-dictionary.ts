import type { BytesBlob } from "@typeberry/bytes";

type IKey = {};

class Key implements IKey {
  constructor(private readonly bytes: BytesBlob) {
    bytes.raw.buffer;

    new DataView(bytes.raw.buffer);
  }
}
export class BlobDictionary<K extends BytesBlob, V> {}
