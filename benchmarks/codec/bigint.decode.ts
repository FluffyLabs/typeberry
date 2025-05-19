import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

class U64 {
  constructor(
    public upper = 0,
    public lower = 0,
  ) {}

  isEqualTo(other: U64) {
    return this.upper === other.upper && this.lower === other.lower;
  }
}

const input = new ArrayBuffer(8);
const view = new DataView(input);
view.setBigUint64(0, 2n ** 60n, true);

export default function run() {
  return suite(
    "BigInt decoding",

    add("decode custom", () => {
      const lower = view.getUint32(0);
      const upper = view.getUint32(4);
      return new U64(upper, lower);
    }),

    add("decode bigint", () => {
      return view.getBigUint64(0, true);
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
