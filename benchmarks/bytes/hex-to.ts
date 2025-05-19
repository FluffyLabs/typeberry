import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const CODE_OF_0 = "0".charCodeAt(0);
const CODE_OF_a = "a".charCodeAt(0);

const size = 256;
const data: number[] = [];
for (let i = 0; i < size; i += 1) {
  data.push(i);
}

function byteToHexString(byte: number): string {
  const nibbleToString = (n: number) => {
    if (n > 9) {
      return String.fromCharCode(n + CODE_OF_a - 10);
    }
    return String.fromCharCode(n + CODE_OF_0);
  };

  return `${nibbleToString(byte >>> 4)}${nibbleToString(byte & 0xf)}`;
}

export default function run() {
  suite(
    "Bytes / into hex",

    add("number toString + padding", () => {
      return data.map((byte) => byte.toString(16).padStart(2, "0"));
    }),

    add("manual", () => {
      return data.map((byte) => byteToHexString(byte));
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
