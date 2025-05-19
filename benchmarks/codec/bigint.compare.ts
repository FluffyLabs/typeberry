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

const otherA = new U64(0xff, 0xff);
const otherB = (0xffn << 32n) + 0xffn;

export default function run() {
  return suite(
    "BigInt compare",

    add("compare custom", () => {
      const lower = view.getUint32(0);
      const upper = view.getUint32(4);
      const n = new U64(upper, lower);
      return () => {
        return n.isEqualTo(otherA);
      };
    }),

    add("compare bigint", () => {
      const n = view.getBigUint64(0, true);
      return () => {
        return n === otherB;
      };
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
