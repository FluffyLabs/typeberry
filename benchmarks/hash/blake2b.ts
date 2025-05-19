import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { BytesBlob } from "@typeberry/bytes";
import { PageAllocator, SimpleAllocator, blake2b } from "@typeberry/hash";

const BLOB_SIZE = 1 * 1024 * 1024;
const NUMBER_OF_HASHES = 512;

function generateBlob(): BytesBlob {
  const result = new Uint8Array(BLOB_SIZE);
  for (let i = 0; i < BLOB_SIZE; i += 1) {
    const val = Math.floor(Math.random() * 255);
    result[i] = val;
  }
  return BytesBlob.blobFrom(result);
}

module.exports = () =>
  suite(
    "Creating many hashes",

    add("hasher with simple allocator", () => {
      const blob = generateBlob();
      const allocator = new SimpleAllocator();

      return () => {
        for (let i = 0; i < NUMBER_OF_HASHES; i += 1) {
          blake2b.hashBytes(blob, allocator);
        }
      };
    }),

    add("hasher with page allocator", () => {
      const blob = generateBlob();
      const allocator = new PageAllocator(128);

      return () => {
        for (let i = 0; i < NUMBER_OF_HASHES; i += 1) {
          blake2b.hashBytes(blob, allocator);
        }
      };
    }),

    // TODO [ToDr] Run in parallel?

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}
